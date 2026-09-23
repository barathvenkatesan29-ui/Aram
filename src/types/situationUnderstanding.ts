export type FactSourceKind = "description" | "answer";

export type AnalysisRound = "initial" | "follow_up";

export type QuestionStatus = "pending" | "answered" | "skipped";

export type FailureCode =
  | "timeout"
  | "invalid-output"
  | "rate-limited"
  | "unavailable";

export type UserFact = {
  text: string;
  quote: string;
  source_kind: FactSourceKind;
  source_question_id: string | null;
};

export type Party = {
  label: string;
  role: string;
};

export type Inference = {
  text: string;
};

export type Assumption = {
  text: string;
  confidence?: "high" | "low";
  because?: string;
};

export type SituationTheme = {
  text: string;
};

export type MissingInformationItem = {
  text: string;
};

export type Uncertainty = {
  text: string;
};

export type ClarificationMateriality = "none" | "orientation_fork";

export type FollowUpQuestion = {
  id: string;
  position: number;
  question: string;
  why_it_matters: string;
  ask_now?: boolean;
  materiality?: ClarificationMateriality;
  already_supplied?: boolean;
  action_mode_only?: boolean;
  suggested_options?: string[];
  clarificationMetadataInvalid?: boolean;
};

export type StoredQuestion = {
  id: string;
  position: number;
  question: string;
  why_it_matters: string;
  status: QuestionStatus;
  answer: string | null;
};

export type CanonicalAnswer = {
  id: string;
  position: number;
  status: QuestionStatus;
  answer: string;
};

export type SituationUnderstanding = {
  userFacts: UserFact[];
  parties: Party[];
  inferences: Inference[];
  assumptions: Assumption[];
  situationThemes: SituationTheme[];
  missingInformation: MissingInformationItem[];
  uncertainties: Uncertainty[];
  questions: FollowUpQuestion[];
};

export type SituationUnderstandingInput = {
  round: AnalysisRound;
  description: string;
  answers: CanonicalAnswer[];
};

export type SituationUnderstandingValidationContext = {
  round: AnalysisRound;
  description: string;
  answers: CanonicalAnswer[];
};

export type SituationUnderstandingValidationResult =
  | { ok: true; understanding: SituationUnderstanding }
  | { ok: false; message: string };

export type StoredQuestionsValidationResult =
  | { ok: true; questions: StoredQuestion[] }
  | { ok: false; message: string };

export type QuestionAnswerValidationResult =
  | { ok: true; status: QuestionStatus; answer: string | null }
  | { ok: false; message: string };

export type AnalysisStatus = "complete" | "failed";

export type AnalysisRecord = {
  id: string;
  caseId: string;
  userId: string;
  round: AnalysisRound;
  parentAnalysisId: string | null;
  status: AnalysisStatus;
  failureCode: FailureCode | null;
  understanding: unknown;
  sourceDescriptionHash: string;
  sourceAnswersHash: string;
};

export type AnalysisQuestionRecord = {
  id: string;
  caseId: string;
  userId: string;
  analysisId: string;
  position: number;
  question: string;
  whyItMatters: string;
  status: QuestionStatus;
  answer: string | null;
};

export type ProviderAvailability = "available" | "unavailable";

export type AskabilityRecord = {
  analysisId: string;
  keepQuestionId: string | null;
  keepQuestionIds: string[];
};

export type StoredAnalysisView =
  | {
      kind: "understood";
      round: AnalysisRound;
      analysisId: string;
      understanding: SituationUnderstanding;
      questions: StoredQuestion[];
    }
  | { kind: "unrenderable" }
  | { kind: "could-not-understand"; failureCode: FailureCode }
  | { kind: "out-of-date" }
  | { kind: "not-understood-yet" };

export type UnderstandCaseResult =
  | { ok: true }
  | { ok: false; message: string };
