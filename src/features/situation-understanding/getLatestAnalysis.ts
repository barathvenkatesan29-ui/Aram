import { parseCaseId } from "@/features/cases/parseCaseId";
import { createClient } from "@/lib/supabase/server";
import type {
  AnalysisQuestionRecord,
  AnalysisRecord,
  AnalysisStatus,
  AnalysisRound,
  AskabilityRecord,
  FailureCode,
  StoredAnalysisView,
} from "@/types/situationUnderstanding";
import { hashCanonicalAnswers, hashCaseDescription } from "./hashCaseInput.ts";
import { parseUuid } from "./parseUuid.ts";
import {
  groupQuestionsByAnalysisId,
  selectStoredAnalysisView,
} from "./selectAnalysisState.ts";

const ANALYSIS_SELECT =
  "id, case_id, user_id, round, parent_analysis_id, status, failure_code, understanding, source_description_hash, source_answers_hash";
const QUESTION_SELECT =
  "id, case_id, user_id, analysis_id, position, question, why_it_matters, status, answer";

export type LatestAnalysisResult = {
  view: StoredAnalysisView;
  askability: AskabilityRecord | null;
  descriptionHash: string;
  emptyAnswersHash: string;
};

export async function getLatestAnalysis(
  caseId: string,
  description: string,
): Promise<LatestAnalysisResult> {
  const descriptionHash = hashCaseDescription(description);
  const emptyAnswersHash = hashCanonicalAnswers([]);
  const emptyResult: LatestAnalysisResult = {
    view: { kind: "not-understood-yet" },
    askability: null,
    descriptionHash,
    emptyAnswersHash,
  };

  const parsedCaseId = parseCaseId(caseId);

  if (!parsedCaseId) {
    return {
      view: { kind: "unrenderable" },
      askability: null,
      descriptionHash,
      emptyAnswersHash,
    };
  }

  const supabase = await createClient();
  const { data: analysisRows, error: analysisError } = await supabase
    .from("case_analyses")
    .select(ANALYSIS_SELECT)
    .eq("case_id", parsedCaseId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (analysisError) {
    console.error("getLatestAnalysis failed", {
      name: analysisError.name,
      code: analysisError.code,
    });
    return {
      view: { kind: "unrenderable" },
      askability: null,
      descriptionHash,
      emptyAnswersHash,
    };
  }

  if (!Array.isArray(analysisRows)) {
    return emptyResult;
  }

  const analyses: AnalysisRecord[] = [];

  for (const row of analysisRows) {
    const parsedRow = parseAnalysisRecord(row);

    if (!parsedRow) {
      console.error("getLatestAnalysis failed", { reason: "invalid-analysis-row" });
      return {
        view: { kind: "unrenderable" },
        askability: null,
        descriptionHash,
        emptyAnswersHash,
      };
    }

    analyses.push(parsedRow);
  }

  const { data: questionRows, error: questionError } = await supabase
    .from("case_questions")
    .select(QUESTION_SELECT)
    .eq("case_id", parsedCaseId)
    .order("position", { ascending: true });

  if (questionError) {
    console.error("getLatestAnalysis failed", {
      name: questionError.name,
      code: questionError.code,
    });
    return {
      view: { kind: "unrenderable" },
      askability: null,
      descriptionHash,
      emptyAnswersHash,
    };
  }

  if (!Array.isArray(questionRows)) {
    return {
      view: { kind: "unrenderable" },
      askability: null,
      descriptionHash,
      emptyAnswersHash,
    };
  }

  const questions: AnalysisQuestionRecord[] = [];

  for (const row of questionRows) {
    const parsedQuestion = parseQuestionRecord(row);

    if (!parsedQuestion) {
      console.error("getLatestAnalysis failed", { reason: "invalid-question-row" });
      return {
        view: { kind: "unrenderable" },
        askability: null,
        descriptionHash,
        emptyAnswersHash,
      };
    }

    questions.push(parsedQuestion);
  }

  const view = selectStoredAnalysisView({
    description,
    descriptionHash,
    emptyAnswersHash,
    analyses,
    questionsByAnalysisId: groupQuestionsByAnalysisId(questions),
  });

  return {
    view,
    askability: await loadAskability(supabase, parsedCaseId, view),
    descriptionHash,
    emptyAnswersHash,
  };
}

async function loadAskability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
  view: StoredAnalysisView,
): Promise<AskabilityRecord | null> {
  if (view.kind !== "understood") {
    return null;
  }

  const { data, error } = await supabase
    .from("case_analysis_askability")
    .select("analysis_id, keep_question_id, keep_question_ids")
    .eq("case_id", caseId)
    .eq("analysis_id", view.analysisId)
    .maybeSingle();

  if (error) {
    console.error("getLatestAnalysis askability failed", {
      name: error.name,
      code: error.code,
    });
    return null;
  }

  return parseAskabilityRecord(data);
}

function parseAskabilityRecord(value: unknown): AskabilityRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    analysis_id?: unknown;
    keep_question_id?: unknown;
    keep_question_ids?: unknown;
  };
  const analysisId =
    typeof record.analysis_id === "string" ? parseUuid(record.analysis_id) : null;

  if (analysisId === null) {
    return null;
  }

  const keepQuestionIds = parseKeepQuestionIds(record.keep_question_ids);

  if (keepQuestionIds === null) {
    if (record.keep_question_id === null) {
      return { analysisId, keepQuestionId: null, keepQuestionIds: [] };
    }

    if (typeof record.keep_question_id !== "string") {
      return null;
    }

    const keepQuestionId = parseUuid(record.keep_question_id);

    if (keepQuestionId === null) {
      return null;
    }

    return {
      analysisId,
      keepQuestionId,
      keepQuestionIds: [keepQuestionId],
    };
  }

  return {
    analysisId,
    keepQuestionId: keepQuestionIds[0] ?? null,
    keepQuestionIds,
  };
}

function parseKeepQuestionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    const parsed = parseUuid(item);

    if (parsed === null) {
      return null;
    }

    ids.push(parsed);
  }

  return ids;
}

function parseAnalysisRecord(value: unknown): AnalysisRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    id?: unknown;
    case_id?: unknown;
    user_id?: unknown;
    round?: unknown;
    parent_analysis_id?: unknown;
    status?: unknown;
    failure_code?: unknown;
    understanding?: unknown;
    source_description_hash?: unknown;
    source_answers_hash?: unknown;
  };

  const id = typeof record.id === "string" ? parseUuid(record.id) : null;
  const caseId =
    typeof record.case_id === "string" ? parseUuid(record.case_id) : null;
  const userId =
    typeof record.user_id === "string" ? parseUuid(record.user_id) : null;
  const round = parseRound(record.round);
  const status = parseAnalysisStatus(record.status);
  const parentAnalysisId = parseOptionalUuid(record.parent_analysis_id);
  const failureCode = parseFailureCode(record.failure_code);

  if (
    id === null ||
    caseId === null ||
    userId === null ||
    round === null ||
    status === null ||
    parentAnalysisId === undefined ||
    failureCode === undefined ||
    typeof record.source_description_hash !== "string" ||
    record.source_description_hash.length === 0 ||
    typeof record.source_answers_hash !== "string" ||
    record.source_answers_hash.length === 0
  ) {
    return null;
  }

  if (status === "complete" && failureCode !== null) {
    return null;
  }

  if (status === "failed" && failureCode === null) {
    return null;
  }

  return {
    id,
    caseId,
    userId,
    round,
    parentAnalysisId,
    status,
    failureCode,
    understanding: record.understanding ?? null,
    sourceDescriptionHash: record.source_description_hash,
    sourceAnswersHash: record.source_answers_hash,
  };
}

function parseQuestionRecord(value: unknown): AnalysisQuestionRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    id?: unknown;
    case_id?: unknown;
    user_id?: unknown;
    analysis_id?: unknown;
    position?: unknown;
    question?: unknown;
    why_it_matters?: unknown;
    status?: unknown;
    answer?: unknown;
  };

  const id = typeof record.id === "string" ? parseUuid(record.id) : null;
  const caseId =
    typeof record.case_id === "string" ? parseUuid(record.case_id) : null;
  const userId =
    typeof record.user_id === "string" ? parseUuid(record.user_id) : null;
  const analysisId =
    typeof record.analysis_id === "string" ? parseUuid(record.analysis_id) : null;

  if (
    id === null ||
    caseId === null ||
    userId === null ||
    analysisId === null ||
    typeof record.position !== "number" ||
    !Number.isInteger(record.position) ||
    typeof record.question !== "string" ||
    typeof record.why_it_matters !== "string" ||
    (record.status !== "pending" &&
      record.status !== "answered" &&
      record.status !== "skipped") ||
    (record.answer !== null && typeof record.answer !== "string")
  ) {
    return null;
  }

  return {
    id,
    caseId,
    userId,
    analysisId,
    position: record.position,
    question: record.question,
    whyItMatters: record.why_it_matters,
    status: record.status,
    answer: record.answer,
  };
}

function parseRound(value: unknown): AnalysisRound | null {
  if (value === "initial" || value === "follow_up") {
    return value;
  }

  return null;
}

function parseAnalysisStatus(value: unknown): AnalysisStatus | null {
  if (value === "complete" || value === "failed") {
    return value;
  }

  return null;
}

function parseOptionalUuid(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return parseUuid(value) ?? undefined;
}

function parseFailureCode(value: unknown): FailureCode | null | undefined {
  if (value === null) {
    return null;
  }

  if (
    value === "timeout" ||
    value === "invalid-output" ||
    value === "rate-limited" ||
    value === "unavailable"
  ) {
    return value;
  }

  return undefined;
}
