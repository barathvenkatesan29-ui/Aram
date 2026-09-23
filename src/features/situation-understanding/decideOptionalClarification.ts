import type {
  AskabilityRecord,
  FollowUpQuestion,
  StoredAnalysisView,
  StoredQuestion,
} from "../../types/situationUnderstanding";
import { toCanonicalAnswers } from "./canonicalAnswers.ts";

export type ClarificationDecision =
  | { kind: "zero" }
  | { kind: "ask"; positions: number[] };

const NON_MATERIAL_ANSWER =
  /^(i\s+don'?t\s+know|don'?t\s+know|not\s+sure|unknown|n\/a|i'?m\s+not\s+sure)$/i;

export function decideOptionalClarification(
  questions: FollowUpQuestion[],
): ClarificationDecision {
  if (questions.some((question) => question.clarificationMetadataInvalid)) {
    return { kind: "zero" };
  }

  const askableQuestions = questions
    .filter(isAskableClarification)
    .sort((left, right) => left.position - right.position);

  if (askableQuestions.length === 0) {
    return { kind: "zero" };
  }

  return {
    kind: "ask",
    positions: askableQuestions.map((question) => question.position),
  };
}

export function selectFinalisedClarifications(input: {
  view: StoredAnalysisView;
  askability: AskabilityRecord | null;
}): StoredQuestion[] {
  if (
    input.askability === null ||
    input.askability.keepQuestionIds.length === 0 ||
    input.view.kind !== "understood" ||
    input.view.round !== "initial" ||
    input.view.analysisId !== input.askability.analysisId
  ) {
    return [];
  }

  const keepIds = new Set(input.askability.keepQuestionIds);

  return input.view.questions
    .filter((question) => keepIds.has(question.id))
    .sort((left, right) => left.position - right.position);
}

export function selectCurrentClarification(
  keeps: StoredQuestion[],
): StoredQuestion | null {
  return keeps.find((question) => question.status === "pending") ?? null;
}

export function shouldRunFollowUp(input: {
  view: StoredAnalysisView;
  askability: AskabilityRecord | null;
  answer: string | null;
}): boolean {
  if (
    input.askability === null ||
    input.askability.keepQuestionIds.length === 0 ||
    input.view.kind !== "understood" ||
    input.view.round !== "initial" ||
    input.view.analysisId !== input.askability.analysisId
  ) {
    return false;
  }

  if (input.answer !== null && isNonMaterialClarificationAnswer(input.answer)) {
    const keeps = selectFinalisedClarifications(input);
    const hasOtherMaterialAnswer = keeps.some(
      (question) =>
        question.status === "answered" &&
        question.answer !== null &&
        !isNonMaterialClarificationAnswer(question.answer),
    );

    if (!hasOtherMaterialAnswer) {
      return false;
    }
  }

  const canonicalAnswers = toCanonicalAnswers(input.view.questions);

  if (canonicalAnswers === null) {
    return false;
  }

  const keeps = selectFinalisedClarifications(input);

  if (keeps.some((question) => question.status === "pending")) {
    return false;
  }

  return keeps.some(
    (question) =>
      question.status === "answered" &&
      question.answer !== null &&
      !isNonMaterialClarificationAnswer(question.answer),
  );
}

export function isNonMaterialClarificationAnswer(answer: string): boolean {
  return NON_MATERIAL_ANSWER.test(answer.trim());
}

export function isAskableClarification(question: FollowUpQuestion): boolean {
  return (
    question.ask_now === true &&
    question.materiality === "orientation_fork" &&
    question.already_supplied === false &&
    question.action_mode_only === false
  );
}
