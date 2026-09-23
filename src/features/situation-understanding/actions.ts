"use server";

import { revalidatePath } from "next/cache";
import { getCase } from "@/features/cases/getCase";
import { parseCaseId } from "@/features/cases/parseCaseId";
import {
  deriveConversationTitle,
  shouldWriteConversationTitle,
} from "@/features/chat/deriveConversationTitle";
import { isIntelligenceReady } from "@/features/chat/provisionalNarrative";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/server/ai/getProvider";
import type { SituationUnderstandingProvider } from "@/server/ai/types";
import type {
  AskabilityRecord,
  CanonicalAnswer,
  FailureCode,
  FollowUpQuestion,
  StoredAnalysisView,
  UnderstandCaseResult,
} from "@/types/situationUnderstanding";
import { getLatestAnalysis } from "./getLatestAnalysis.ts";
import { hashCanonicalAnswers, hashCaseDescription } from "./hashCaseInput.ts";
import { questionsForRpc } from "./questionsForRpc.ts";
import { hasRevalidatedCurrentComplete } from "./selectAnalysisState.ts";
import { validateSituationUnderstanding } from "./validateSituationUnderstanding.ts";
import {
  decideOptionalClarification,
  shouldRunFollowUp,
} from "./decideOptionalClarification.ts";
import { parseUuid } from "./parseUuid.ts";
import { toCanonicalAnswers } from "./canonicalAnswers.ts";

const APPLICATION_THROTTLE_LIMIT = 10;
const APPLICATION_THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_ATTEMPTS = 3;

function getSignedInUserId(claims: { sub?: unknown } | undefined): string | null {
  if (typeof claims?.sub !== "string") {
    return null;
  }

  return parseCaseId(claims.sub);
}

export async function understandCase(
  rawCaseId: string,
): Promise<UnderstandCaseResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = getSignedInUserId(data?.claims);

  if (!userId) {
    return {
      ok: false,
      message: "Your sign-in has expired. Sign in again, then try again.",
    };
  }

  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return {
      ok: false,
      message: "We could not understand this case. Please try again.",
    };
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return {
      ok: false,
      message: "We could not understand this case. Please try again.",
    };
  }

  if (!isIntelligenceReady(savedCase.description)) {
    return {
      ok: false,
      message: "Please describe a little more about what happened.",
    };
  }

  const latestAnalysis = await getLatestAnalysis(caseId, savedCase.description);

  if (hasRevalidatedCurrentComplete(latestAnalysis.view)) {
    await finaliseAskabilityIfNeeded({
      supabase,
      view: latestAnalysis.view,
      askability: latestAnalysis.askability,
    });
    await persistFriendlyTitleIfNeeded({
      supabase,
      caseId,
      description: savedCase.description,
      currentTitle: savedCase.title,
    });
    revalidateConversation(caseId);
    return { ok: true };
  }

  const throttleCount = await countRecentAnalyses(supabase);

  if (throttleCount === null) {
    return {
      ok: false,
      message: "We could not understand this case. Please try again.",
    };
  }

  if (throttleCount >= APPLICATION_THROTTLE_LIMIT) {
    return {
      ok: false,
      message:
        "You have reached the limit of 10 understanding attempts for today. Please try again tomorrow.",
    };
  }

  const providerResolution = getProvider();

  if (!providerResolution.ok) {
    return {
      ok: false,
      message: "Understanding unavailable.",
    };
  }

  const description = savedCase.description.trim();
  const sourceDescriptionHash = hashCaseDescription(description);
  const sourceAnswersHash = hashCanonicalAnswers([]);
  const providerResult = await callProvider(
    providerResolution.provider,
    {
      round: "initial",
      description,
      answers: [],
    },
  );

  if (providerResult.kind === "unclassified") {
    return {
      ok: false,
      message: "We could not understand this case. Please try again.",
    };
  }

  if (providerResult.kind === "classified-failure") {
    await persistFailedInitial({
      supabase,
      caseId,
      userId,
      failureCode: providerResult.failureCode,
      sourceDescriptionHash,
      sourceAnswersHash,
      providerId: providerResolution.provider.id,
      modelName: providerResolution.provider.modelName,
    });
    revalidateConversation(caseId);
    return {
      ok: false,
      message: "Could not understand this situation. You can try again.",
    };
  }

  const validation = validateSituationUnderstanding(providerResult.output, {
    round: "initial",
    description,
    answers: [],
  });

  if (!validation.ok) {
    await persistFailedInitial({
      supabase,
      caseId,
      userId,
      failureCode: "invalid-output",
      sourceDescriptionHash,
      sourceAnswersHash,
      providerId: providerResolution.provider.id,
      modelName: providerResolution.provider.modelName,
    });
    revalidateConversation(caseId);
    return {
      ok: false,
      message: "Could not understand this situation. You can try again.",
    };
  }

  const { data: persistedId, error: persistError } = await supabase.rpc(
    "persist_complete_initial_analysis",
    {
      p_case_id: caseId,
      p_understanding: validation.understanding,
      p_source_description_hash: sourceDescriptionHash,
      p_source_answers_hash: sourceAnswersHash,
      p_provider_id: providerResolution.provider.id,
      p_model_name: providerResolution.provider.modelName,
      p_questions: questionsForRpc(validation.understanding.questions),
    },
  );

  if (persistError || typeof persistedId !== "string" || parseCaseId(persistedId) === null) {
    console.error("understandCase persist failed", {
      name: persistError?.name,
      code: persistError?.code,
    });
    return {
      ok: false,
      message: "We could not save this understanding. Please try again.",
    };
  }

  await finaliseAskabilityAfterPersist({
    supabase,
    analysisId: persistedId,
    questions: validation.understanding.questions,
  });

  await persistFriendlyTitleIfNeeded({
    supabase,
    caseId,
    description,
    currentTitle: savedCase.title,
  });
  revalidateConversation(caseId);
  return { ok: true };
}

async function countRecentAnalyses(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number | null> {
  const windowStart = new Date(
    Date.now() - APPLICATION_THROTTLE_WINDOW_MS,
  ).toISOString();
  const { count, error } = await supabase
    .from("case_analyses")
    .select("id", { count: "exact", head: true })
    .gte("created_at", windowStart);

  if (error) {
    console.error("understandCase throttle failed", {
      name: error.name,
      code: error.code,
    });
    return null;
  }

  return count ?? 0;
}

async function callProvider(
  provider: SituationUnderstandingProvider,
  input: {
    round: "initial" | "follow_up";
    description: string;
    answers: CanonicalAnswer[];
  },
): Promise<
  | { kind: "ok"; output: unknown }
  | { kind: "classified-failure"; failureCode: FailureCode }
  | { kind: "unclassified" }
> {
  let sawTimeout = false;
  let sawEmpty = false;

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    try {
      const output = await withTimeout(
        provider.understand({
          round: input.round,
          description: input.description,
          answers: input.answers,
        }),
        PROVIDER_TIMEOUT_MS,
      );

      if (output === null || output === undefined) {
        sawEmpty = true;

        if (attempt < MAX_PROVIDER_ATTEMPTS) {
          continue;
        }

        return { kind: "classified-failure", failureCode: "invalid-output" };
      }

      return { kind: "ok", output };
    } catch (error) {
      if (isTimeoutError(error)) {
        sawTimeout = true;

        if (attempt < MAX_PROVIDER_ATTEMPTS) {
          continue;
        }

        return { kind: "classified-failure", failureCode: "timeout" };
      }

      console.error("understandCase provider failed", {
        name: error instanceof Error ? error.name : "Error",
      });
      return { kind: "unclassified" };
    }
  }

  if (sawTimeout) {
    return { kind: "classified-failure", failureCode: "timeout" };
  }

  if (sawEmpty) {
    return { kind: "classified-failure", failureCode: "invalid-output" };
  }

  return { kind: "unclassified" };
}

async function persistFailedInitial(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  caseId: string;
  userId: string;
  failureCode: FailureCode;
  sourceDescriptionHash: string;
  sourceAnswersHash: string;
  providerId: string;
  modelName: string;
}): Promise<void> {
  const { error } = await input.supabase.from("case_analyses").insert({
    case_id: input.caseId,
    user_id: input.userId,
    round: "initial",
    parent_analysis_id: null,
    status: "failed",
    failure_code: input.failureCode,
    understanding: null,
    source_description_hash: input.sourceDescriptionHash,
    source_answers_hash: input.sourceAnswersHash,
    provider_id: input.providerId,
    model_name: input.modelName,
  });

  if (error) {
    console.error("understandCase failed-row persist failed", {
      name: error.name,
      code: error.code,
    });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutError = new Error("timeout");
      timeoutError.name = "TimeoutError";
      reject(timeoutError);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function revalidateConversation(caseId: string): void {
  revalidatePath("/chat");
  revalidatePath(`/chat/${caseId}`);
  revalidatePath(`/cases/${caseId}`);
}

async function finaliseAskabilityIfNeeded(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  view: StoredAnalysisView;
  askability: AskabilityRecord | null;
}): Promise<void> {
  if (
    input.askability !== null ||
    input.view.kind !== "understood" ||
    input.view.round !== "initial"
  ) {
    return;
  }

  await finaliseAskabilityAfterPersist({
    supabase: input.supabase,
    analysisId: input.view.analysisId,
    questions: input.view.understanding.questions,
  });
}

async function finaliseAskabilityAfterPersist(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  analysisId: string;
  questions: FollowUpQuestion[];
}): Promise<void> {
  const decision = decideOptionalClarification(input.questions);
  const keepQuestionIds =
    decision.kind === "ask"
      ? await lookupQuestionIdsByPositions(
          input.supabase,
          input.analysisId,
          decision.positions,
        )
      : [];

  if (decision.kind === "ask" && keepQuestionIds.length !== decision.positions.length) {
    return;
  }

  const { error } = await input.supabase.rpc("finalise_optional_clarification", {
    p_analysis_id: input.analysisId,
    p_keep_question_ids: keepQuestionIds,
  });

  if (error) {
    console.error("understandCase finalise failed", {
      name: error.name,
      code: error.code,
    });
  }
}

async function lookupQuestionIdsByPositions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analysisId: string,
  positions: number[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const position of positions) {
    const { data, error } = await supabase
      .from("case_questions")
      .select("id, position")
      .eq("analysis_id", analysisId)
      .eq("position", position)
      .maybeSingle();

    if (error) {
      console.error("understandCase keep-question lookup failed", {
        name: error.name,
        code: error.code,
      });
      return [];
    }

    if (typeof data?.id !== "string") {
      return [];
    }

    const parsed = parseUuid(data.id);

    if (parsed === null) {
      return [];
    }

    ids.push(parsed);
  }

  return ids;
}

export async function runClarificationFollowUp(
  caseId: string,
  answer: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = getSignedInUserId(data?.claims);

  if (!userId) {
    return;
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return;
  }

  const latestAnalysis = await getLatestAnalysis(caseId, savedCase.description);

  if (
    !shouldRunFollowUp({
      view: latestAnalysis.view,
      askability: latestAnalysis.askability,
      answer,
    })
  ) {
    return;
  }

  if (latestAnalysis.view.kind !== "understood") {
    return;
  }

  const canonicalAnswers = toCanonicalAnswers(latestAnalysis.view.questions);

  if (canonicalAnswers === null) {
    return;
  }

  const throttleCount = await countRecentAnalyses(supabase);

  if (throttleCount === null || throttleCount >= APPLICATION_THROTTLE_LIMIT) {
    return;
  }

  const providerResolution = getProvider();
  const parentAnalysisId = latestAnalysis.askability?.analysisId ?? null;
  const sourceDescriptionHash = hashCaseDescription(savedCase.description);
  const sourceAnswersHash = hashCanonicalAnswers(canonicalAnswers);

  if (!providerResolution.ok || parentAnalysisId === null) {
    await persistFailedFollowUp({
      supabase,
      caseId,
      userId,
      parentAnalysisId,
      failureCode: "unavailable",
      sourceDescriptionHash,
      sourceAnswersHash,
      providerId: "unavailable",
      modelName: "unavailable",
    });
    return;
  }

  const providerResult = await callProvider(providerResolution.provider, {
    round: "follow_up",
    description: savedCase.description.trim(),
    answers: canonicalAnswers,
  });

  if (providerResult.kind === "unclassified") {
    return;
  }

  if (providerResult.kind === "classified-failure") {
    await persistFailedFollowUp({
      supabase,
      caseId,
      userId,
      parentAnalysisId,
      failureCode: providerResult.failureCode,
      sourceDescriptionHash,
      sourceAnswersHash,
      providerId: providerResolution.provider.id,
      modelName: providerResolution.provider.modelName,
    });
    return;
  }

  const validation = validateSituationUnderstanding(providerResult.output, {
    round: "follow_up",
    description: savedCase.description.trim(),
    answers: canonicalAnswers,
  });

  if (!validation.ok) {
    await persistFailedFollowUp({
      supabase,
      caseId,
      userId,
      parentAnalysisId,
      failureCode: "invalid-output",
      sourceDescriptionHash,
      sourceAnswersHash,
      providerId: providerResolution.provider.id,
      modelName: providerResolution.provider.modelName,
    });
    return;
  }

  const { error: persistError } = await supabase.rpc("persist_complete_follow_up", {
    p_case_id: caseId,
    p_parent_analysis_id: parentAnalysisId,
    p_understanding: validation.understanding,
    p_source_description_hash: sourceDescriptionHash,
    p_source_answers_hash: sourceAnswersHash,
    p_provider_id: providerResolution.provider.id,
    p_model_name: providerResolution.provider.modelName,
  });

  if (persistError) {
    console.error("runClarificationFollowUp persist failed", {
      name: persistError.name,
      code: persistError.code,
    });
  }
}

async function persistFailedFollowUp(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  caseId: string;
  userId: string;
  parentAnalysisId: string | null;
  failureCode: FailureCode;
  sourceDescriptionHash: string;
  sourceAnswersHash: string;
  providerId: string;
  modelName: string;
}): Promise<void> {
  if (input.parentAnalysisId === null) {
    return;
  }

  const { error } = await input.supabase.from("case_analyses").insert({
    case_id: input.caseId,
    user_id: input.userId,
    round: "follow_up",
    parent_analysis_id: input.parentAnalysisId,
    status: "failed",
    failure_code: input.failureCode,
    understanding: null,
    source_description_hash: input.sourceDescriptionHash,
    source_answers_hash: input.sourceAnswersHash,
    provider_id: input.providerId,
    model_name: input.modelName,
  });

  if (error) {
    console.error("runClarificationFollowUp failed-row persist failed", {
      name: error.name,
      code: error.code,
    });
  }
}

async function persistFriendlyTitleIfNeeded(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  caseId: string;
  description: string;
  currentTitle: string | null;
}): Promise<void> {
  if (!shouldWriteConversationTitle(input.currentTitle)) {
    return;
  }

  const title = deriveConversationTitle(input.description);

  if (!title) {
    return;
  }

  const { error } = await input.supabase
    .from("cases")
    .update({ title })
    .eq("id", input.caseId)
    .is("title", null);

  if (error) {
    console.error("understandCase title persist failed", {
      name: error.name,
      code: error.code,
    });
  }
}
