import type {
  AnalysisQuestionRecord,
  AnalysisRecord,
  FailureCode,
  FollowUpQuestion,
  SituationUnderstanding,
  StoredAnalysisView,
  StoredQuestion,
} from "../../types/situationUnderstanding.ts";
import { toCanonicalAnswers } from "./canonicalAnswers.ts";
import { hashCanonicalAnswers } from "./hashCaseInput.ts";
import { validateStoredQuestions } from "./validateQuestionAnswer.ts";
import { validateSituationUnderstanding } from "./validateSituationUnderstanding.ts";

export function hasRevalidatedCurrentComplete(
  view: StoredAnalysisView,
): boolean {
  return view.kind === "understood";
}

// Analyses must already be ordered by created_at desc, id desc.
export function selectStoredAnalysisView(input: {
  description: string;
  descriptionHash: string;
  emptyAnswersHash: string;
  analyses: AnalysisRecord[];
  questionsByAnalysisId: ReadonlyMap<string, AnalysisQuestionRecord[]>;
}): StoredAnalysisView {
  const followUpView = selectCurrentFollowUp(input);

  if (followUpView) {
    return followUpView;
  }

  const initialView = selectCurrentInitial(input);

  if (initialView) {
    return initialView;
  }

  const relevantFailure = newestRelevantFailedInitial(input);

  if (relevantFailure) {
    return {
      kind: "could-not-understand",
      failureCode: relevantFailure,
    };
  }

  if (input.analyses.some((analysis) => analysis.status === "complete")) {
    return { kind: "out-of-date" };
  }

  return { kind: "not-understood-yet" };
}

function selectCurrentFollowUp(input: {
  description: string;
  descriptionHash: string;
  emptyAnswersHash: string;
  analyses: AnalysisRecord[];
  questionsByAnalysisId: ReadonlyMap<string, AnalysisQuestionRecord[]>;
}): StoredAnalysisView | null {
  for (const analysis of input.analyses) {
    if (analysis.status !== "complete" || analysis.round !== "follow_up") {
      continue;
    }

    if (analysis.sourceDescriptionHash !== input.descriptionHash) {
      continue;
    }

    return revalidateCurrentFollowUp({
      followUp: analysis,
      description: input.description,
      descriptionHash: input.descriptionHash,
      emptyAnswersHash: input.emptyAnswersHash,
      analyses: input.analyses,
      questionsByAnalysisId: input.questionsByAnalysisId,
    });
  }

  return null;
}

function selectCurrentInitial(input: {
  description: string;
  descriptionHash: string;
  emptyAnswersHash: string;
  analyses: AnalysisRecord[];
  questionsByAnalysisId: ReadonlyMap<string, AnalysisQuestionRecord[]>;
}): StoredAnalysisView | null {
  for (const analysis of input.analyses) {
    if (analysis.status !== "complete" || analysis.round !== "initial") {
      continue;
    }

    if (
      analysis.sourceDescriptionHash !== input.descriptionHash ||
      analysis.sourceAnswersHash !== input.emptyAnswersHash
    ) {
      continue;
    }

    const understanding = revalidateInitialUnderstanding(
      analysis,
      input.description,
    );

    if (!understanding) {
      return { kind: "unrenderable" };
    }

    const questions = revalidateAnalysisQuestions(analysis, input);

    if (questions === null) {
      return { kind: "unrenderable" };
    }

    if (!questionsMatchUnderstanding(questions, understanding.questions)) {
      return { kind: "unrenderable" };
    }

    return {
      kind: "understood",
      round: "initial",
      analysisId: analysis.id,
      understanding,
      questions,
    };
  }

  return null;
}

function revalidateCurrentFollowUp(input: {
  followUp: AnalysisRecord;
  description: string;
  descriptionHash: string;
  emptyAnswersHash: string;
  analyses: AnalysisRecord[];
  questionsByAnalysisId: ReadonlyMap<string, AnalysisQuestionRecord[]>;
}): StoredAnalysisView {
  if (input.followUp.parentAnalysisId === null) {
    return { kind: "unrenderable" };
  }

  const parent = input.analyses.find(
    (analysis) => analysis.id === input.followUp.parentAnalysisId,
  );

  if (
    !parent ||
    parent.round !== "initial" ||
    parent.status !== "complete" ||
    parent.sourceDescriptionHash !== input.descriptionHash ||
    parent.sourceAnswersHash !== input.emptyAnswersHash
  ) {
    return { kind: "unrenderable" };
  }

  const parentQuestions = revalidateAnalysisQuestions(parent, {
    questionsByAnalysisId: input.questionsByAnalysisId,
  });

  if (parentQuestions === null) {
    return { kind: "unrenderable" };
  }

  const canonicalAnswers = toCanonicalAnswers(parentQuestions);

  if (
    canonicalAnswers === null ||
    hashCanonicalAnswers(canonicalAnswers) !== input.followUp.sourceAnswersHash
  ) {
    return { kind: "unrenderable" };
  }

  const followUpQuestions = input.questionsByAnalysisId.get(input.followUp.id);

  if (followUpQuestions !== undefined && followUpQuestions.length > 0) {
    return { kind: "unrenderable" };
  }

  const understandingResult = validateSituationUnderstanding(
    input.followUp.understanding,
    {
      round: "follow_up",
      description: input.description,
      answers: canonicalAnswers,
    },
  );

  if (!understandingResult.ok) {
    return { kind: "unrenderable" };
  }

  return {
    kind: "understood",
    round: "follow_up",
    analysisId: input.followUp.id,
    understanding: understandingResult.understanding,
    questions: [],
  };
}

function revalidateInitialUnderstanding(
  analysis: AnalysisRecord,
  description: string,
): SituationUnderstanding | null {
  const result = validateSituationUnderstanding(analysis.understanding, {
    round: "initial",
    description,
    answers: [],
  });

  if (!result.ok) {
    return null;
  }

  return result.understanding;
}

function revalidateAnalysisQuestions(
  analysis: AnalysisRecord,
  input: {
    questionsByAnalysisId: ReadonlyMap<string, AnalysisQuestionRecord[]>;
  },
): StoredQuestion[] | null {
  const rows = input.questionsByAnalysisId.get(analysis.id) ?? [];

  for (const row of rows) {
    if (
      row.analysisId !== analysis.id ||
      row.caseId !== analysis.caseId ||
      row.userId !== analysis.userId
    ) {
      return null;
    }
  }

  const result = validateStoredQuestions(
    rows.map((row) => ({
      id: row.id,
      position: row.position,
      question: row.question,
      why_it_matters: row.whyItMatters,
      status: row.status,
      answer: row.answer,
    })),
  );

  if (!result.ok) {
    return null;
  }

  return result.questions;
}

function questionsMatchUnderstanding(
  questions: StoredQuestion[],
  understandingQuestions: FollowUpQuestion[],
): boolean {
  if (questions.length !== understandingQuestions.length) {
    return false;
  }

  return questions.every((question, index) => {
    const understandingQuestion = understandingQuestions[index];

    return (
      understandingQuestion !== undefined &&
      question.position === understandingQuestion.position &&
      question.question === understandingQuestion.question &&
      question.why_it_matters === understandingQuestion.why_it_matters
    );
  });
}

function newestRelevantFailedInitial(input: {
  descriptionHash: string;
  emptyAnswersHash: string;
  analyses: AnalysisRecord[];
}): FailureCode | null {
  for (const analysis of input.analyses) {
    if (
      analysis.status === "failed" &&
      analysis.round === "initial" &&
      analysis.sourceDescriptionHash === input.descriptionHash &&
      analysis.sourceAnswersHash === input.emptyAnswersHash &&
      analysis.failureCode !== null
    ) {
      return analysis.failureCode;
    }
  }

  return null;
}

export function groupQuestionsByAnalysisId(
  questions: AnalysisQuestionRecord[],
): Map<string, AnalysisQuestionRecord[]> {
  const questionsByAnalysisId = new Map<string, AnalysisQuestionRecord[]>();

  for (const question of questions) {
    const existingQuestions = questionsByAnalysisId.get(question.analysisId);

    if (existingQuestions) {
      existingQuestions.push(question);
      continue;
    }

    questionsByAnalysisId.set(question.analysisId, [question]);
  }

  return questionsByAnalysisId;
}
