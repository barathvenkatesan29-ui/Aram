import type {
  AnalysisQuestionRecord,
  AnalysisRecord,
  FailureCode,
} from "../../types/situationUnderstanding.ts";
import { hashCanonicalAnswers, hashCaseDescription } from "./hashCaseInput.ts";
import {
  groupQuestionsByAnalysisId,
  hasRevalidatedCurrentComplete,
  selectStoredAnalysisView,
} from "./selectAnalysisState.ts";

export const CURRENT_DESCRIPTION =
  "The landlord kept the rental deposit after I moved out of the flat in Pune in March.";
export const PREVIOUS_DESCRIPTION =
  "The previous description was about a delayed furniture delivery in Mumbai in January.";

const CASE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INITIAL_ID = "11111111-1111-4111-8111-111111111111";
const FOLLOW_UP_ID = "22222222-2222-4222-8222-222222222222";
const STALE_INITIAL_ID = "33333333-3333-4333-8333-333333333333";
const FAILED_ID = "44444444-4444-4444-8444-444444444444";
const QUESTION_ID = "55555555-5555-4555-8555-555555555555";
const MODEL_QUESTION_ID = "66666666-6666-4666-8666-666666666666";

export const currentDescriptionHash = hashCaseDescription(CURRENT_DESCRIPTION);
export const previousDescriptionHash = hashCaseDescription(PREVIOUS_DESCRIPTION);
export const emptyAnswersHash = hashCanonicalAnswers([]);

export function validInitialUnderstanding(overrides?: Record<string, unknown>) {
  return {
    userFacts: [
      {
        text: "The landlord kept the rental deposit.",
        quote: "The landlord kept the rental deposit",
        source_kind: "description",
        source_question_id: null,
      },
    ],
    parties: [{ label: "landlord", role: "other party" }],
    inferences: [],
    assumptions: [],
    situationThemes: [{ text: "rental deposit" }],
    missingInformation: [],
    uncertainties: [],
    questions: [
      {
        id: MODEL_QUESTION_ID,
        position: 1,
        question: "When did this happen?",
        why_it_matters: "A date can show what is still missing.",
      },
    ],
    ...overrides,
  };
}

export function validFollowUpUnderstanding(overrides?: Record<string, unknown>) {
  return {
    userFacts: [
      {
        text: "The landlord kept the rental deposit.",
        quote: "The landlord kept the rental deposit",
        source_kind: "description",
        source_question_id: null,
      },
      {
        text: "The user said this happened in March.",
        quote: "March 2026",
        source_kind: "answer",
        source_question_id: QUESTION_ID,
      },
    ],
    parties: [{ label: "landlord", role: "other party" }],
    inferences: [],
    assumptions: [],
    situationThemes: [{ text: "rental deposit" }],
    missingInformation: [],
    uncertainties: [],
    questions: [],
    ...overrides,
  };
}

export function analysisRecord(
  overrides: Partial<AnalysisRecord> & Pick<AnalysisRecord, "id" | "round" | "status">,
): AnalysisRecord {
  return {
    caseId: CASE_ID,
    userId: USER_ID,
    parentAnalysisId: null,
    failureCode: null,
    understanding: validInitialUnderstanding(),
    sourceDescriptionHash: currentDescriptionHash,
    sourceAnswersHash: emptyAnswersHash,
    ...overrides,
  };
}

export function questionRecord(
  overrides?: Partial<AnalysisQuestionRecord>,
): AnalysisQuestionRecord {
  return {
    id: QUESTION_ID,
    caseId: CASE_ID,
    userId: USER_ID,
    analysisId: INITIAL_ID,
    position: 1,
    question: "When did this happen?",
    whyItMatters: "A date can show what is still missing.",
    status: "pending",
    answer: null,
    ...overrides,
  };
}

export function answeredParentQuestion(): AnalysisQuestionRecord {
  return questionRecord({
    status: "answered",
    answer: "March 2026",
  });
}

export function parentAnswersHash(): string {
  return hashCanonicalAnswers([
    {
      id: QUESTION_ID,
      position: 1,
      status: "answered",
      answer: "March 2026",
    },
  ]);
}

export function selectView(input: {
  description?: string;
  analyses: AnalysisRecord[];
  questions?: AnalysisQuestionRecord[];
}) {
  const description = input.description ?? CURRENT_DESCRIPTION;

  return selectStoredAnalysisView({
    description,
    descriptionHash: hashCaseDescription(description),
    emptyAnswersHash,
    analyses: input.analyses,
    questionsByAnalysisId: groupQuestionsByAnalysisId(input.questions ?? []),
  });
}

export {
  CASE_ID,
  USER_ID,
  INITIAL_ID,
  FOLLOW_UP_ID,
  STALE_INITIAL_ID,
  FAILED_ID,
  QUESTION_ID,
  MODEL_QUESTION_ID,
};

export function failedInitial(
  failureCode: FailureCode = "invalid-output",
): AnalysisRecord {
  return analysisRecord({
    id: FAILED_ID,
    round: "initial",
    status: "failed",
    failureCode,
    understanding: null,
  });
}

export { hasRevalidatedCurrentComplete };
