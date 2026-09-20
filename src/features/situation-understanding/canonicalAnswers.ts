import type {
  CanonicalAnswer,
  StoredQuestion,
} from "../../types/situationUnderstanding";

export function toCanonicalAnswers(
  questions: StoredQuestion[],
): CanonicalAnswer[] | null {
  const orderedQuestions = [...questions].sort(
    (left, right) => left.position - right.position,
  );

  const answers: CanonicalAnswer[] = [];

  for (const question of orderedQuestions) {
    if (question.status === "pending") {
      return null;
    }

    answers.push({
      id: question.id,
      position: question.position,
      status: question.status,
      answer: question.status === "answered" ? question.answer?.trim() ?? "" : "",
    });
  }

  return answers;
}
