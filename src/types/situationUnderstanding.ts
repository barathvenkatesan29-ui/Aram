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

export type FollowUpQuestion = {
  id: string;
  position: number;
  question: string;
  why_it_matters: string;
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
