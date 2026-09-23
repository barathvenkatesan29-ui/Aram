import type { FollowUpQuestion } from "../../types/situationUnderstanding";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "that",
  "this",
  "it",
  "if",
  "with",
  "by",
  "from",
  "as",
  "has",
  "have",
  "had",
  "did",
  "does",
  "do",
  "you",
  "your",
  "they",
  "them",
  "their",
  "any",
  "not",
]);

export function reassessRemainingClarifications(input: {
  remaining: FollowUpQuestion[];
  narrative: string;
  latestAnswer: string;
}): { skipQuestionIds: string[] } {
  const combinedNarrative = `${input.narrative}\n${input.latestAnswer}`.trim();
  const skipQuestionIds: string[] = [];

  for (const question of input.remaining) {
    if (
      isAlreadyCoveredByNarrative(question, combinedNarrative) ||
      isAlreadyCoveredByNarrative(question, input.latestAnswer)
    ) {
      skipQuestionIds.push(question.id);
    }
  }

  return { skipQuestionIds };
}

export function isAlreadyCoveredByNarrative(
  question: FollowUpQuestion,
  narrative: string,
): boolean {
  const tokens = distinctiveTokens(question.question);
  const haystack = normalize(narrative);

  if (tokens.length === 0) {
    return false;
  }

  const matched = tokens.filter((token) => haystack.includes(token)).length;
  const needed = Math.min(2, tokens.length);
  return matched >= needed;
}

function distinctiveTokens(value: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const token of normalize(value).split(" ")) {
    if (token.length < 4 || STOP_WORDS.has(token) || seen.has(token)) {
      continue;
    }

    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}
