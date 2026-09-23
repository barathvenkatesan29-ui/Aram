import type {
  AnalysisRound,
  Assumption,
  CanonicalAnswer,
  FollowUpQuestion,
  Inference,
  MissingInformationItem,
  Party,
  SituationTheme,
  SituationUnderstandingValidationContext,
  SituationUnderstandingValidationResult,
  Uncertainty,
  UserFact,
} from "../../types/situationUnderstanding";
import { parseUuid } from "./parseUuid.ts";

export const MAX_USER_FACTS = 20;
export const MAX_PARTIES = 10;
export const MAX_INFERENCES = 20;
export const MAX_ASSUMPTIONS = 20;
export const MAX_SITUATION_THEMES = 10;
export const MAX_MISSING_INFORMATION = 10;
export const MAX_UNCERTAINTIES = 10;
export const MAX_FOLLOW_UP_QUESTIONS = 5;
export const MAX_SUGGESTED_OPTIONS = 3;
export const MAX_FIELD_TEXT_LENGTH = 2000;

const URL_PATTERN = /https?:\/\//i;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\([^)]*\)/;

const LEGAL_THEME_PATTERNS: readonly RegExp[] = [
  /\bbreach of contract\b/i,
  /\bunjust enrichment\b/i,
  /\bcriminal intimidation\b/i,
  /\bthis law applies\b/i,
  /\bthe other party is liable\b/i,
  /\bliable\b/i,
  /\bnegligence\b/i,
  /\bfraud\b/i,
  /\bcheating\b/i,
  /\boffence\b/i,
  /\boffense\b/i,
  /\blegal right/i,
  /\byour rights\b/i,
  /\bdut(y|ies)\b/i,
  /\bstatute\b/i,
  /\bregulation\b/i,
  /\bjudgment\b/i,
  /\bdoctrine\b/i,
  /\bsection\s*\d+/i,
  /\bsec\.\s*\d+/i,
  /\bs\.\s*\d+/i,
  /\bipc\b/i,
  /\bbns\b/i,
  /\bcrpc\b/i,
  /\bbnss\b/i,
];

const IDENTITY_QUESTION_PATTERNS: readonly RegExp[] = [
  /\baadhaar\b/i,
  /\baadhar\b/i,
  /\bpan\b/i,
  /\bpassport\b/i,
  /\bifsc\b/i,
  /\bbank account\b/i,
  /\botp\b/i,
  /\bpassword\b/i,
  /\bprivate document/i,
];

export function validateSituationUnderstanding(
  value: unknown,
  context: SituationUnderstandingValidationContext,
): SituationUnderstandingValidationResult {
  if (typeof value !== "object" || value === null) {
    return invalidOutput();
  }

  const record = value as {
    userFacts?: unknown;
    parties?: unknown;
    inferences?: unknown;
    assumptions?: unknown;
    situationThemes?: unknown;
    missingInformation?: unknown;
    uncertainties?: unknown;
    questions?: unknown;
  };

  const answersById = new Map(
    context.answers.map((answer) => [answer.id, answer]),
  );

  const userFacts = readUserFacts(record.userFacts, context, answersById);

  if (userFacts === null) {
    return invalidOutput();
  }

  const parties = readTextItems(record.parties, parseParty, MAX_PARTIES);

  if (parties === null) {
    return invalidOutput();
  }

  const inferences = readTextItems(
    record.inferences,
    parseTextItem,
    MAX_INFERENCES,
  );

  if (inferences === null) {
    return invalidOutput();
  }

  const assumptions = readTextItems(
    record.assumptions,
    parseAssumption,
    MAX_ASSUMPTIONS,
  );

  if (assumptions === null) {
    return invalidOutput();
  }

  const situationThemes = readTextItems(
    record.situationThemes,
    parseSituationTheme,
    MAX_SITUATION_THEMES,
  );

  if (situationThemes === null) {
    return invalidOutput();
  }

  const missingInformation = readTextItems(
    record.missingInformation,
    parseTextItem,
    MAX_MISSING_INFORMATION,
  );

  if (missingInformation === null) {
    return invalidOutput();
  }

  const uncertainties = readTextItems(
    record.uncertainties,
    parseTextItem,
    MAX_UNCERTAINTIES,
  );

  if (uncertainties === null) {
    return invalidOutput();
  }

  const questions = readQuestions(record.questions, context.round);

  if (questions === null) {
    return invalidOutput();
  }

  return {
    ok: true,
    understanding: {
      userFacts,
      parties,
      inferences,
      assumptions,
      situationThemes,
      missingInformation,
      uncertainties,
      questions,
    },
  };
}

function invalidOutput(): SituationUnderstandingValidationResult {
  return {
    ok: false,
    message: "This understanding could not be used.",
  };
}

function readUserFacts(
  value: unknown,
  context: SituationUnderstandingValidationContext,
  answersById: Map<string, CanonicalAnswer>,
): UserFact[] | null {
  if (!Array.isArray(value) || value.length > MAX_USER_FACTS) {
    return null;
  }

  const userFacts: UserFact[] = [];

  for (const item of value) {
    const parsedFact = parseUserFact(item);

    if (parsedFact === "invalid") {
      return null;
    }

    if (parsedFact === "drop") {
      continue;
    }

    if (context.round === "initial" && parsedFact.source_kind === "answer") {
      return null;
    }

    if (parsedFact.source_kind === "description") {
      if (
        !quoteMatchesSource(parsedFact.quote, context.description) ||
        parsedFact.source_question_id !== null
      ) {
        continue;
      }
    } else {
      if (parsedFact.source_question_id === null) {
        return null;
      }

      const sourceAnswer = answersById.get(parsedFact.source_question_id);

      if (
        sourceAnswer === undefined ||
        sourceAnswer.status !== "answered" ||
        !quoteMatchesSource(parsedFact.quote, sourceAnswer.answer)
      ) {
        continue;
      }
    }

    userFacts.push(parsedFact);
  }

  return userFacts;
}

function parseUserFact(
  value: unknown,
): UserFact | "drop" | "invalid" {
  if (typeof value !== "object" || value === null) {
    return "invalid";
  }

  const record = value as {
    text?: unknown;
    quote?: unknown;
    source_kind?: unknown;
    source_question_id?: unknown;
  };

  const text = parseRequiredText(record.text);

  if (text === null || containsForbiddenLink(text)) {
    return "invalid";
  }

  if (typeof record.quote !== "string") {
    return "invalid";
  }

  const quote = record.quote.trim();

  if (quote.length === 0 || quote.length > MAX_FIELD_TEXT_LENGTH) {
    return "drop";
  }

  if (containsForbiddenLink(quote)) {
    return "invalid";
  }

  if (record.source_kind === "description") {
    if (record.source_question_id !== null && record.source_question_id !== undefined) {
      return "invalid";
    }

    return {
      text,
      quote,
      source_kind: "description",
      source_question_id: null,
    };
  }

  if (record.source_kind === "answer") {
    if (typeof record.source_question_id !== "string") {
      return "invalid";
    }

    const sourceQuestionId = parseUuid(record.source_question_id);

    if (sourceQuestionId === null) {
      return "invalid";
    }

    return {
      text,
      quote,
      source_kind: "answer",
      source_question_id: sourceQuestionId,
    };
  }

  return "invalid";
}

function parseParty(value: unknown): Party | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as { label?: unknown; role?: unknown };
  const label = parseRequiredText(record.label);
  const role = parseRequiredText(record.role);

  if (label === null || role === null) {
    return null;
  }

  if (containsForbiddenLink(label) || containsForbiddenLink(role)) {
    return null;
  }

  return { label, role };
}

function parseTextItem(
  value: unknown,
): Inference | Assumption | MissingInformationItem | Uncertainty | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as { text?: unknown };
  const text = parseRequiredText(record.text);

  if (text === null || containsForbiddenLink(text)) {
    return null;
  }

  return { text };
}

function parseAssumption(value: unknown): Assumption | null {
  const item = parseTextItem(value);

  if (item === null) {
    return null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as { confidence?: unknown; because?: unknown };
  const assumption: Assumption = { text: item.text };

  if (record.confidence === "high" || record.confidence === "low") {
    assumption.confidence = record.confidence;
  }

  if (typeof record.because === "string") {
    const because = record.because.trim();

    if (
      because.length > 0 &&
      because.length <= MAX_FIELD_TEXT_LENGTH &&
      !containsForbiddenLink(because)
    ) {
      assumption.because = because;
    }
  }

  return assumption;
}

function parseSituationTheme(value: unknown): SituationTheme | null {
  const item = parseTextItem(value);

  if (item === null) {
    return null;
  }

  if (containsLegalThemeLanguage(item.text)) {
    return null;
  }

  return item;
}

function readTextItems<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
  maxItems: number,
): T[] | null {
  if (!Array.isArray(value) || value.length > maxItems) {
    return null;
  }

  const items: T[] = [];

  for (const item of value) {
    const parsedItem = parseItem(item);

    if (parsedItem === null) {
      return null;
    }

    items.push(parsedItem);
  }

  return items;
}

function readQuestions(
  value: unknown,
  round: AnalysisRound,
): FollowUpQuestion[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (round === "follow_up") {
    return value.length === 0 ? [] : null;
  }

  if (value.length > MAX_FOLLOW_UP_QUESTIONS) {
    return null;
  }

  const questions: FollowUpQuestion[] = [];
  const seenPositions = new Set<number>();
  const seenIds = new Set<string>();

  for (const item of value) {
    const question = parseFollowUpQuestion(item);

    if (question === null) {
      return null;
    }

    if (seenPositions.has(question.position) || seenIds.has(question.id)) {
      return null;
    }

    seenPositions.add(question.position);
    seenIds.add(question.id);
    questions.push(question);
  }

  questions.sort((left, right) => left.position - right.position);

  for (const [index, question] of questions.entries()) {
    if (question.position !== index + 1) {
      return null;
    }
  }

  return questions;
}

function parseFollowUpQuestion(value: unknown): FollowUpQuestion | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    id?: unknown;
    position?: unknown;
    question?: unknown;
    why_it_matters?: unknown;
    ask_now?: unknown;
    materiality?: unknown;
    already_supplied?: unknown;
    action_mode_only?: unknown;
    suggested_options?: unknown;
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

  if (record.position < 1 || record.position > MAX_FOLLOW_UP_QUESTIONS) {
    return null;
  }

  const question = parseRequiredText(record.question);
  const whyItMatters = parseRequiredText(record.why_it_matters);

  if (question === null || whyItMatters === null) {
    return null;
  }

  if (containsForbiddenLink(question) || containsForbiddenLink(whyItMatters)) {
    return null;
  }

  if (
    containsIdentityRequest(question) ||
    containsIdentityRequest(whyItMatters)
  ) {
    return null;
  }

  const clarification = parseClarificationMetadata(record);
  const suggestedOptions = parseSuggestedOptions(record.suggested_options);

  if (clarification === "invalid") {
    return {
      id,
      position: record.position,
      question,
      why_it_matters: whyItMatters,
      clarificationMetadataInvalid: true,
    };
  }

  return {
    id,
    position: record.position,
    question,
    why_it_matters: whyItMatters,
    ...clarification,
    ...(suggestedOptions.length > 0 ? { suggested_options: suggestedOptions } : {}),
  };
}

function parseClarificationMetadata(record: {
  ask_now?: unknown;
  materiality?: unknown;
  already_supplied?: unknown;
  action_mode_only?: unknown;
}):
  | Pick<
      FollowUpQuestion,
      "ask_now" | "materiality" | "already_supplied" | "action_mode_only"
    >
  | "invalid"
  | Record<string, never> {
  const hasAskNow = record.ask_now !== undefined;
  const hasMateriality = record.materiality !== undefined;
  const hasAlreadySupplied = record.already_supplied !== undefined;
  const hasActionModeOnly = record.action_mode_only !== undefined;

  if (
    !hasAskNow &&
    !hasMateriality &&
    !hasAlreadySupplied &&
    !hasActionModeOnly
  ) {
    return {};
  }

  if (hasAskNow && typeof record.ask_now !== "boolean") {
    return "invalid";
  }

  if (hasAlreadySupplied && typeof record.already_supplied !== "boolean") {
    return "invalid";
  }

  if (hasActionModeOnly && typeof record.action_mode_only !== "boolean") {
    return "invalid";
  }

  if (
    hasMateriality &&
    record.materiality !== "none" &&
    record.materiality !== "orientation_fork"
  ) {
    return "invalid";
  }

  return {
    ...(hasAskNow ? { ask_now: record.ask_now === true } : {}),
    ...(hasMateriality
      ? {
          materiality:
            record.materiality === "orientation_fork"
              ? "orientation_fork"
              : "none",
        }
      : {}),
    ...(hasAlreadySupplied
      ? { already_supplied: record.already_supplied === true }
      : {}),
    ...(hasActionModeOnly
      ? { action_mode_only: record.action_mode_only === true }
      : {}),
  };
}

function parseSuggestedOptions(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_SUGGESTED_OPTIONS) {
    return [];
  }

  const options: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const option = parseRequiredText(item);

    if (option === null || containsForbiddenLink(option) || containsIdentityRequest(option)) {
      continue;
    }

    const key = option.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push(option);
  }

  return options;
}

function parseRequiredText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0 || trimmedValue.length > MAX_FIELD_TEXT_LENGTH) {
    return null;
  }

  return trimmedValue;
}

export function quoteMatchesSource(quote: string, source: string): boolean {
  const normalizedQuote = normalizeForQuote(quote);
  const normalizedSource = normalizeForQuote(source);

  if (normalizedQuote.length === 0) {
    return false;
  }

  return normalizedSource.includes(normalizedQuote);
}

function normalizeForQuote(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsForbiddenLink(value: string): boolean {
  return URL_PATTERN.test(value) || MARKDOWN_LINK_PATTERN.test(value);
}

function containsLegalThemeLanguage(value: string): boolean {
  return LEGAL_THEME_PATTERNS.some((pattern) => pattern.test(value));
}

function containsIdentityRequest(value: string): boolean {
  return IDENTITY_QUESTION_PATTERNS.some((pattern) => pattern.test(value));
}
