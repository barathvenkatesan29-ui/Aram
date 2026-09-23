import type {
  Assumption,
  CanonicalAnswer,
  Party,
  SituationTheme,
  SituationUnderstanding,
  UserFact,
} from "../../types/situationUnderstanding.ts";
import { extractUncertainties } from "../../features/situation-understanding/situationFromDescription.ts";

const GENERIC_WANT_PATTERN =
  /\bi want to understand\b|\bwhat i can reasonably do next\b|\bwhat (can|should) i do\b/i;
const PARTY_PATTERNS: readonly { pattern: RegExp; role: string; label: string }[] = [
  { pattern: /\bmarketplace\b/i, role: "organisation", label: "marketplace" },
  { pattern: /\bseller\b/i, role: "other party", label: "seller" },
  { pattern: /\blandlord\b/i, role: "other party", label: "landlord" },
  { pattern: /\blandlady\b/i, role: "other party", label: "landlady" },
  { pattern: /\bemployer\b/i, role: "other party", label: "employer" },
  { pattern: /\bneighbour\b/i, role: "other person", label: "neighbour" },
  { pattern: /\bneighbor\b/i, role: "other person", label: "neighbor" },
  { pattern: /\bbuilder\b/i, role: "other party", label: "builder" },
  { pattern: /\bcompany\b/i, role: "organisation", label: "company" },
  { pattern: /\bbank\b(?!\s+statement)/i, role: "organisation", label: "bank" },
  { pattern: /\bsupport keeps\b|\bcustomer support\b/i, role: "organisation", label: "support" },
  { pattern: /\bhr\b|\bhuman resources\b/i, role: "organisation", label: "hr" },
];
const LEGAL_THEME_PATTERN =
  /\b(liable|statute|section\s*\d+|your rights|legal right|offence|offense|negligence|fraud|cheating|duty|duties)\b/i;
const URL_PATTERN = /https?:\/\//i;

export function organiseStubSituation(input: {
  description: string;
  answers?: CanonicalAnswer[];
}): SituationUnderstanding {
  const description = input.description.trim();
  const descriptionFacts = factsFromSource({
    source: description,
    sourceKind: "description",
    sourceQuestionId: null,
  });
  const answerFacts = (input.answers ?? [])
    .filter((answer) => answer.status === "answered" && answer.answer.trim().length > 0)
    .flatMap((answer) =>
      factsFromSource({
        source: answer.answer,
        sourceKind: "answer",
        sourceQuestionId: answer.id,
      }),
    );

  const userFacts = [...descriptionFacts, ...answerFacts].slice(0, 20);

  return {
    userFacts,
    parties: partiesFromDescription(description),
    inferences: [],
    assumptions: assumptionsFromDescription(description),
    situationThemes: themesFromDescription(description),
    missingInformation: [],
    uncertainties: extractUncertainties(description).map((text) => ({ text })),
    questions: [],
  };
}

function factsFromSource(input: {
  source: string;
  sourceKind: "description" | "answer";
  sourceQuestionId: string | null;
}): UserFact[] {
  const facts: UserFact[] = [];

  for (const sentence of splitSentences(input.source)) {
    if (URL_PATTERN.test(sentence) || GENERIC_WANT_PATTERN.test(sentence)) {
      continue;
    }

    if (sentence.length < 12) {
      continue;
    }

    facts.push({
      text: sentence,
      quote: sentence,
      source_kind: input.sourceKind,
      source_question_id: input.sourceQuestionId,
    });
  }

  return facts;
}

function partiesFromDescription(description: string): Party[] {
  const parties: Party[] = [];
  const seen = new Set<string>();

  for (const candidate of PARTY_PATTERNS) {
    if (!candidate.pattern.test(description) || seen.has(candidate.label)) {
      continue;
    }

    seen.add(candidate.label);
    parties.push({ label: candidate.label, role: candidate.role });
  }

  return parties.slice(0, 10);
}

function themesFromDescription(description: string): SituationTheme[] {
  const sentences = splitSentences(description).filter(
    (sentence) =>
      !URL_PATTERN.test(sentence) &&
      !GENERIC_WANT_PATTERN.test(sentence) &&
      !LEGAL_THEME_PATTERN.test(sentence),
  );
  const first = sentences[0];

  if (first !== undefined && first.length > 0) {
    return [{ text: first.length > 160 ? `${first.slice(0, 157).trim()}...` : first }];
  }

  return [];
}

function assumptionsFromDescription(description: string): Assumption[] {
  const assumptions: Assumption[] = [];
  const pickupMatch = description.match(
    /\b((?:return )?pickup (?:was )?(?:completed|done)|pickup confirmation|picked up|collection confirmation)\b/i,
  );

  if (pickupMatch && pickupMatch[0] && !/\binspected\b|\baccepted\b/i.test(description)) {
    assumptions.push({
      text: "I'm assuming the item was successfully picked up.",
      confidence: "high",
      because: pickupMatch[0],
    });
  }

  return assumptions;
}

export function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
