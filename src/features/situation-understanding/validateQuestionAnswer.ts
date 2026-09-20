import type {
  QuestionAnswerValidationResult,
  QuestionStatus,
  StoredQuestion,
  StoredQuestionsValidationResult,
} from "../../types/situationUnderstanding";
import { parseUuid } from "./parseUuid.ts";

export const MAX_ANSWER_LENGTH = 2000;
export const MAX_STORED_QUESTIONS = 5;

export function validateQuestionAnswer(input: {
  status: unknown;
  answer: unknown;
}): QuestionAnswerValidationResult {
  const status = parseQuestionStatus(input.status);

  if (status === null) {
    return {
      ok: false,
      message: "That answer could not be saved. Please try again.",
    };
  }

  if (status === "pending" || status === "skipped") {
    if (input.answer !== null) {
      return {
        ok: false,
        message: "That answer could not be saved. Please try again.",
      };
    }

    return { ok: true, status, answer: null };
  }

  if (typeof input.answer !== "string") {
    return {
      ok: false,
      message: "Please enter an answer, or skip this question.",
    };
  }

  if (input.answer.length > MAX_ANSWER_LENGTH) {
    return {
      ok: false,
      message:
        "Please shorten the answer. This version accepts up to 2,000 characters.",
    };
  }

  const trimmedAnswer = input.answer.trim();

  if (trimmedAnswer.length < 1 || trimmedAnswer.length > MAX_ANSWER_LENGTH) {
    return {
      ok: false,
      message: "Please enter an answer, or skip this question.",
    };
  }

  return { ok: true, status: "answered", answer: input.answer };
}

export function validateStoredQuestions(
  value: unknown,
): StoredQuestionsValidationResult {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      message: "This understanding could not be shown.",
    };
  }

  if (value.length > MAX_STORED_QUESTIONS) {
    return {
      ok: false,
      message: "This understanding could not be shown.",
    };
  }

  const questions: StoredQuestion[] = [];
  const seenPositions = new Set<number>();
  const seenIds = new Set<string>();

  for (const item of value) {
    const question = parseStoredQuestion(item);

    if (question === null) {
      return {
        ok: false,
        message: "This understanding could not be shown.",
      };
    }

    if (seenPositions.has(question.position) || seenIds.has(question.id)) {
      return {
        ok: false,
        message: "This understanding could not be shown.",
      };
    }

    seenPositions.add(question.position);
    seenIds.add(question.id);
    questions.push(question);
  }

  questions.sort((left, right) => left.position - right.position);

  for (const [index, question] of questions.entries()) {
    if (question.position !== index + 1) {
      return {
        ok: false,
        message: "This understanding could not be shown.",
      };
    }
  }

  return { ok: true, questions };
}

function parseQuestionStatus(value: unknown): QuestionStatus | null {
  if (value === "pending" || value === "answered" || value === "skipped") {
    return value;
  }

  return null;
}

function parseStoredQuestion(value: unknown): StoredQuestion | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    id?: unknown;
    position?: unknown;
    question?: unknown;
    why_it_matters?: unknown;
    status?: unknown;
    answer?: unknown;
  };

  if (typeof record.id !== "string") {
    return null;
  }

  const id = parseUuid(record.id);

  if (id === null) {
    return null;
  }

  if (typeof record.position !== "number" || !Number.isInteger(record.position)) {
    return null;
  }

  if (record.position < 1 || record.position > MAX_STORED_QUESTIONS) {
    return null;
  }

  if (typeof record.question !== "string" || record.question.trim().length === 0) {
    return null;
  }

  if (
    typeof record.why_it_matters !== "string" ||
    record.why_it_matters.trim().length === 0
  ) {
    return null;
  }

  const answerResult = validateQuestionAnswer({
    status: record.status,
    answer: record.answer ?? null,
  });

  if (!answerResult.ok) {
    return null;
  }

  return {
    id,
    position: record.position,
    question: record.question,
    why_it_matters: record.why_it_matters,
    status: answerResult.status,
    answer: answerResult.answer,
  };
}
