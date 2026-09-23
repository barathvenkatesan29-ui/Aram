"use server";

import { revalidatePath } from "next/cache";
import { getCase } from "@/features/cases/getCase";
import { parseCaseId } from "@/features/cases/parseCaseId";
import { createClient } from "@/lib/supabase/server";
import { getLatestAnalysis } from "@/features/situation-understanding/getLatestAnalysis";
import { hasRevalidatedCurrentComplete } from "@/features/situation-understanding/selectAnalysisState";
import { understandCase, runClarificationFollowUp } from "@/features/situation-understanding/actions";
import { parseUuid } from "@/features/situation-understanding/parseUuid";
import {
  selectCurrentClarification,
  selectFinalisedClarifications,
} from "@/features/situation-understanding/decideOptionalClarification";
import { reassessRemainingClarifications } from "@/features/situation-understanding/reassessRemainingClarifications";
import { validateQuestionAnswer } from "@/features/situation-understanding/validateQuestionAnswer";
import {
  shouldAppendPreUnderstanding,
  shouldAttemptInitialUnderstanding,
} from "./projectAramTurn";
import { validateUserMessage } from "./validateUserMessage";
import { validateConversationTitle } from "./conversationManagement";
import {
  CLOSED_ACTION_MESSAGE,
  FROZEN_FREE_TEXT_MESSAGE,
  looksLikeClosedActionRequest,
} from "./closedActionRequest";

export type ConversationActionResult =
  | { ok: true; caseId: string }
  | { ok: false; message: string };

export type SendMessageResult = ConversationActionResult;

function getSignedInUserId(claims: { sub?: unknown } | undefined): string | null {
  if (typeof claims?.sub !== "string") {
    return null;
  }

  return parseCaseId(claims.sub);
}

export async function sendMessage(
  rawCaseId: string | null,
  body: string,
): Promise<SendMessageResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = getSignedInUserId(data?.claims);

  if (!userId) {
    return {
      ok: false,
      message: "Your sign-in has expired. Sign in again, then try again.",
    };
  }

  const validation = validateUserMessage(body);

  if (!validation.ok) {
    return validation;
  }

  if (rawCaseId === null) {
    return createConversationWithFirstMessage(body.trim());
  }

  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return {
      ok: false,
      message: "We could not send that message. Please try again.",
    };
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return {
      ok: false,
      message: "We could not send that message. Please try again.",
    };
  }

  const latestAnalysis = await getLatestAnalysis(caseId, savedCase.description);

  if (!shouldAppendPreUnderstanding(hasRevalidatedCurrentComplete(latestAnalysis.view))) {
    return {
      ok: false,
      message: looksLikeClosedActionRequest(body)
        ? CLOSED_ACTION_MESSAGE
        : FROZEN_FREE_TEXT_MESSAGE,
    };
  }

  const { error: appendError } = await supabase.rpc(
    "append_pre_understanding_message",
    {
      p_case_id: caseId,
      p_body: body.trim(),
    },
  );

  if (appendError) {
    console.error("sendMessage append failed", {
      name: appendError.name,
      code: appendError.code,
    });
    return {
      ok: false,
      message:
        appendError.code === "23514"
          ? "Please shorten the message. Together these notes can be up to 8,000 characters."
          : "We could not send that message. Please try again.",
    };
  }

  return finishAfterPersist(caseId);
}

export async function answerOptionalClarification(
  rawCaseId: string,
  rawQuestionId: string,
  body: string,
): Promise<SendMessageResult> {
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
  const questionId = parseUuid(rawQuestionId);

  if (!caseId || questionId === null) {
    return {
      ok: false,
      message: "We could not save that detail. Please try again.",
    };
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return {
      ok: false,
      message: "We could not save that detail. Please try again.",
    };
  }

  const latestAnalysis = await getLatestAnalysis(caseId, savedCase.description);
  const current = selectCurrentClarification(
    selectFinalisedClarifications({
      view: latestAnalysis.view,
      askability: latestAnalysis.askability,
    }),
  );

  if (
    shouldAppendPreUnderstanding(hasRevalidatedCurrentComplete(latestAnalysis.view)) ||
    current === null ||
    current.id !== questionId
  ) {
    return {
      ok: false,
      message: "This optional detail is not open.",
    };
  }

  const validation = validateQuestionAnswer({
    status: "answered",
    answer: body,
  });

  if (!validation.ok || validation.answer === null) {
    return {
      ok: false,
      message:
        validation.ok === false &&
        validation.message === "Please enter an answer, or skip this question."
          ? "Please enter this detail, or skip it."
          : validation.ok === false
            ? validation.message
            : "Please enter this detail, or skip it.",
    };
  }

  const { error } = await supabase.rpc("answer_optional_clarification", {
    p_question_id: questionId,
    p_body: validation.answer,
  });

  if (error) {
    console.error("answerOptionalClarification failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not save that detail. Please try again.",
    };
  }

  const descriptionAfterAnswer = await getCase(caseId);

  if (
    descriptionAfterAnswer &&
    descriptionAfterAnswer.description !== savedCase.description
  ) {
    console.error("answerOptionalClarification failed", {
      reason: "description-rewritten",
    });
    return {
      ok: false,
      message: "We could not save that detail. Please try again.",
    };
  }

  await settleRemainingClarifications(caseId, savedCase.description, validation.answer);
  await runClarificationFollowUp(caseId, validation.answer);
  revalidatePath("/chat");
  revalidatePath(`/chat/${caseId}`);
  return { ok: true, caseId };
}

export async function skipOptionalClarification(
  rawCaseId: string,
  rawQuestionId: string,
): Promise<SendMessageResult> {
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
  const questionId = parseUuid(rawQuestionId);

  if (!caseId || questionId === null) {
    return {
      ok: false,
      message: "We could not skip that detail. Please try again.",
    };
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return {
      ok: false,
      message: "We could not skip that detail. Please try again.",
    };
  }

  const latestAnalysis = await getLatestAnalysis(caseId, savedCase.description);
  const current = selectCurrentClarification(
    selectFinalisedClarifications({
      view: latestAnalysis.view,
      askability: latestAnalysis.askability,
    }),
  );

  if (
    shouldAppendPreUnderstanding(hasRevalidatedCurrentComplete(latestAnalysis.view)) ||
    current === null ||
    current.id !== questionId
  ) {
    return {
      ok: false,
      message: "This optional detail is not open.",
    };
  }

  const { error } = await supabase.rpc("skip_optional_clarification", {
    p_question_id: questionId,
  });

  if (error) {
    console.error("skipOptionalClarification failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not skip that detail. Please try again.",
    };
  }

  await runClarificationFollowUp(caseId, null);
  revalidatePath("/chat");
  revalidatePath(`/chat/${caseId}`);
  return { ok: true, caseId };
}

async function settleRemainingClarifications(
  caseId: string,
  description: string,
  latestAnswer: string,
): Promise<void> {
  const latestAnalysis = await getLatestAnalysis(caseId, description);

  if (latestAnalysis.view.kind !== "understood") {
    return;
  }

  const keeps = selectFinalisedClarifications({
    view: latestAnalysis.view,
    askability: latestAnalysis.askability,
  });
  const remaining = keeps.filter((question) => question.status === "pending");

  if (remaining.length === 0) {
    return;
  }

  const remainingFollowUps = remaining.map((question) => {
    const fromUnderstanding =
      latestAnalysis.view.kind === "understood"
        ? latestAnalysis.view.understanding.questions.find(
            (candidate) => candidate.position === question.position,
          )
        : undefined;

    return {
      id: question.id,
      position: question.position,
      question: fromUnderstanding?.question ?? question.question,
      why_it_matters: fromUnderstanding?.why_it_matters ?? question.why_it_matters,
      ask_now: true as const,
      materiality: "orientation_fork" as const,
      already_supplied: false,
      action_mode_only: false,
    };
  });

  const { skipQuestionIds } = reassessRemainingClarifications({
    remaining: remainingFollowUps,
    narrative: description,
    latestAnswer,
  });
  const skipIds = new Set(skipQuestionIds);
  const supabase = await createClient();

  for (const question of remaining) {
    if (!skipIds.has(question.id)) {
      continue;
    }

    const { error } = await supabase.rpc("skip_optional_clarification", {
      p_question_id: question.id,
    });

    if (error) {
      console.error("settleRemainingClarifications failed", {
        name: error.name,
        code: error.code,
      });
    }
  }
}

async function createConversationWithFirstMessage(
  body: string,
): Promise<SendMessageResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_case_with_first_message", {
    p_body: body,
  });

  if (error) {
    console.error("sendMessage create failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not start this conversation. Please try again.",
    };
  }

  const created = parseCreatedConversation(data);

  if (!created) {
    console.error("sendMessage create failed", { reason: "invalid-created-conversation" });
    return {
      ok: false,
      message: "We could not start this conversation. Please try again.",
    };
  }

  return finishAfterPersist(created.caseId);
}

async function finishAfterPersist(caseId: string): Promise<SendMessageResult> {
  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return {
      ok: false,
      message: "We could not send that message. Please try again.",
    };
  }

  const latestAnalysis = await getLatestAnalysis(caseId, savedCase.description);

  if (
    shouldAttemptInitialUnderstanding({
      description: savedCase.description,
      isFrozen: hasRevalidatedCurrentComplete(latestAnalysis.view),
    })
  ) {
    await understandCase(caseId);
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${caseId}`);
  return { ok: true, caseId };
}

function parseCreatedConversation(
  value: unknown,
): { caseId: string; messageId: string } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as { case_id?: unknown; message_id?: unknown };
  const caseId = typeof record.case_id === "string" ? parseCaseId(record.case_id) : null;
  const messageId =
    typeof record.message_id === "string" ? parseUuid(record.message_id) : null;

  if (caseId === null || messageId === null) {
    return null;
  }

  return { caseId, messageId };
}

export async function renameConversation(
  rawCaseId: string,
  rawTitle: string,
): Promise<ConversationActionResult> {
  const prepared = await prepareOwnedConversationAction(rawCaseId, "rename");

  if (!prepared.ok) {
    return prepared;
  }

  const validation = validateConversationTitle(rawTitle);

  if (!validation.ok) {
    return validation;
  }

  const { data: renamedCase, error } = await prepared.supabase
    .from("cases")
    .update({ title: validation.title })
    .eq("id", prepared.caseId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("renameConversation failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not rename this conversation. Please try again.",
    };
  }

  const renamedId =
    typeof renamedCase?.id === "string" ? parseCaseId(renamedCase.id) : null;

  if (!renamedId) {
    return {
      ok: false,
      message: "We could not rename this conversation. Please try again.",
    };
  }

  revalidateConversationPaths(prepared.caseId);
  return { ok: true, caseId: prepared.caseId };
}

export async function archiveConversation(
  rawCaseId: string,
): Promise<ConversationActionResult> {
  return setConversationArchivedAt(rawCaseId, new Date().toISOString(), "archive");
}

export async function unarchiveConversation(
  rawCaseId: string,
): Promise<ConversationActionResult> {
  return setConversationArchivedAt(rawCaseId, null, "unarchive");
}

export async function deleteConversation(
  rawCaseId: string,
): Promise<ConversationActionResult> {
  const prepared = await prepareOwnedConversationAction(rawCaseId, "delete");

  if (!prepared.ok) {
    return prepared;
  }

  const { data: deletedCase, error } = await prepared.supabase
    .from("cases")
    .delete()
    .eq("id", prepared.caseId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteConversation failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not delete this conversation. Please try again.",
    };
  }

  const deletedId =
    typeof deletedCase?.id === "string" ? parseCaseId(deletedCase.id) : null;

  if (!deletedId) {
    return {
      ok: false,
      message: "We could not delete this conversation. Please try again.",
    };
  }

  revalidateConversationPaths(deletedId);
  return { ok: true, caseId: deletedId };
}

async function setConversationArchivedAt(
  rawCaseId: string,
  archivedAt: string | null,
  action: "archive" | "unarchive",
): Promise<ConversationActionResult> {
  const prepared = await prepareOwnedConversationAction(rawCaseId, action);

  if (!prepared.ok) {
    return prepared;
  }

  const { data: updatedCase, error } = await prepared.supabase
    .from("cases")
    .update({ archived_at: archivedAt })
    .eq("id", prepared.caseId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`${action}Conversation failed`, {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message:
        action === "archive"
          ? "We could not archive this conversation. Please try again."
          : "We could not restore this conversation. Please try again.",
    };
  }

  const updatedId =
    typeof updatedCase?.id === "string" ? parseCaseId(updatedCase.id) : null;

  if (!updatedId) {
    return {
      ok: false,
      message:
        action === "archive"
          ? "We could not archive this conversation. Please try again."
          : "We could not restore this conversation. Please try again.",
    };
  }

  revalidateConversationPaths(prepared.caseId);
  return { ok: true, caseId: prepared.caseId };
}

async function prepareOwnedConversationAction(
  rawCaseId: string,
  action: "rename" | "archive" | "unarchive" | "delete",
): Promise<
  | { ok: true; caseId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; message: string }
> {
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
    return failedConversationAction(action);
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return failedConversationAction(action);
  }

  return { ok: true, caseId, supabase };
}

function failedConversationAction(
  action: "rename" | "archive" | "unarchive" | "delete",
): { ok: false; message: string } {
  if (action === "rename") {
    return { ok: false, message: "We could not rename this conversation. Please try again." };
  }

  if (action === "delete") {
    return { ok: false, message: "We could not delete this conversation. Please try again." };
  }

  if (action === "archive") {
    return { ok: false, message: "We could not archive this conversation. Please try again." };
  }

  return { ok: false, message: "We could not restore this conversation. Please try again." };
}

function revalidateConversationPaths(caseId: string): void {
  revalidatePath("/chat");
  revalidatePath("/chat/archived");
  revalidatePath(`/chat/${caseId}`);
}
