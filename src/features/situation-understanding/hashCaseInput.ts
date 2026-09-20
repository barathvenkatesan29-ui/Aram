import { createHash } from "node:crypto";
import type { CanonicalAnswer } from "../../types/situationUnderstanding";

export function hashUtf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashCaseDescription(description: string): string {
  return hashUtf8(description.trim());
}

export function hashCanonicalAnswers(answers: CanonicalAnswer[]): string {
  return hashUtf8(serializeCanonicalAnswers(answers));
}

export function hashCaseInput(
  description: string,
  answers: CanonicalAnswer[],
): {
  sourceDescriptionHash: string;
  sourceAnswersHash: string;
} {
  return {
    sourceDescriptionHash: hashCaseDescription(description),
    sourceAnswersHash: hashCanonicalAnswers(answers),
  };
}

export function serializeCanonicalAnswers(answers: CanonicalAnswer[]): string {
  const orderedAnswers = [...answers].sort(
    (left, right) => left.position - right.position,
  );

  return JSON.stringify(
    orderedAnswers.map((item) => ({
      id: item.id,
      position: item.position,
      status: item.status,
      answer: item.answer,
    })),
  );
}
