import type { SituationUnderstanding } from "../../types/situationUnderstanding.ts";
import { CLOSED_ACTION_MESSAGE } from "./closedActionRequest.ts";
import {
  draftCopyFor,
  extractAvoidActions,
  extractEvidenceItems,
  extractNextSteps,
  extractStanding,
  interpretWhatsHappening,
  isNextStepResolved,
  type ActionableNextStep,
  type NextStepAction,
  type StandingModel,
} from "../situation-understanding/situationFromDescription.ts";

const GENERIC_FACT_PATTERN =
  /\bthe user described a situation\b|\bthe user added this in a follow-up answer\b/i;
const GENERIC_THEME_PATTERN = /\bneeds examination\b/i;
const GENERIC_WANT_PATTERN =
  /\bi want to understand\b|\bwhat i can reasonably do next\b|\bwhat (can|should) i do\b/i;
const LEGAL_COPY_PATTERN =
  /\b(liable|statute|section\s*\d+|your rights|legal right|offence|offense|file a case|ipc|crpc|waiver|deadline|consumer forum)\b/i;
const URL_PATTERN = /https?:\/\//i;
const VAGUE_STEP_PATTERN =
  /\bexplore options\b|\blearn more\b|\bask for (an )?explanation\b/i;

export type ConversationActionId = "view-evidence" | "open-verified-source";

export type ConversationAction =
  | { id: "view-evidence"; label: string }
  | { id: "open-verified-source"; label: string; url: string; title: string };

export type { ActionableNextStep, NextStepAction, StandingModel };

export const FUTURE_CONVERSATION_ACTION_LABELS = [
  "Draft a message",
  "Prepare a complaint",
  "Prepare a notice",
  "Understand where I can file",
  "Prepare complaint",
  "Prepare legal notice",
  "Start filing workflow",
] as const;

export const DEPRECATED_CONVERSATION_ACTION_LABELS = [
  "Ask for an explanation",
  "Organise my evidence",
] as const;

export type EvidenceSummary = {
  count: number;
  preview: string[];
};

export type LegalPositionModel = {
  ready: false;
  issue: null;
  position: null;
  why: null;
  sources: [];
};

export type HelpNextCapability = {
  id: string;
  label: string;
  action: NextStepAction;
};

export type RecommendedNextAction = {
  stepId: string;
  summary: string;
  action: NextStepAction | null;
};

export type OrientationModel = {
  whatsHappening: string;
  standing: StandingModel;
  nextSteps: ActionableNextStep[];
  whatYouShouldntDo: string[];
  evidence: EvidenceSummary;
  legalPosition: LegalPositionModel;
  helpNext: HelpNextCapability[];
  recommendedNextAction: RecommendedNextAction | null;
  assumptions: string[];
  stillUnclear: string[];
  drafts: Record<string, string>;
  actions: ConversationAction[];
};

export function projectOrientationModel(input: {
  description: string;
  understanding: SituationUnderstanding;
}): OrientationModel {
  const description = input.description.trim();
  const whatsHappening = buildWhatsHappening(description, input.understanding);
  const standing = extractStanding(description);
  if (standing.currentAssumption === null) {
    standing.currentAssumption = buildAssumptions(input.understanding)[0] ?? null;
  }
  const nextSteps = extractNextSteps(description).filter(
    (step) =>
      !LEGAL_COPY_PATTERN.test(step.text) &&
      !LEGAL_COPY_PATTERN.test(step.why) &&
      !VAGUE_STEP_PATTERN.test(step.text) &&
      (step.action === null ||
        !FUTURE_CONVERSATION_ACTION_LABELS.includes(
          step.action.label as (typeof FUTURE_CONVERSATION_ACTION_LABELS)[number],
        )),
  );
  const whatYouShouldntDo = extractAvoidActions(description).filter(
    (item) => !LEGAL_COPY_PATTERN.test(item),
  );
  const evidenceItems = extractEvidenceItems(description);
  const evidence: EvidenceSummary = {
    count: evidenceItems.length,
    preview: evidenceItems.slice(0, 3),
  };
  const assumptions =
    standing.currentAssumption !== null ? [standing.currentAssumption] : [];
  const drafts = draftsForSteps(nextSteps);
  const helpNext = helpNextFrom(nextSteps);
  const recommendedNextAction = selectRecommendedNextAction(nextSteps, description);

  return {
    whatsHappening,
    standing,
    nextSteps,
    whatYouShouldntDo,
    evidence,
    legalPosition: {
      ready: false,
      issue: null,
      position: null,
      why: null,
      sources: [],
    },
    helpNext,
    recommendedNextAction,
    assumptions,
    stillUnclear: [],
    drafts,
    actions: [],
  };
}

export function formatOrientationBody(model: OrientationModel): string {
  const sections: string[] = [];

  if (model.whatsHappening.length > 0) {
    sections.push(`What's happening\n${model.whatsHappening}`);
  }

  if (
    model.standing.inYourFavour.length > 0 ||
    model.standing.currentObstacle !== null ||
    model.standing.currentAssumption !== null
  ) {
    const lines = ["Where you currently stand"];

    if (model.standing.inYourFavour.length > 0) {
      lines.push("In your favour");
      lines.push(...model.standing.inYourFavour.map((item) => `- ${item}`));
    }

    if (model.standing.currentObstacle !== null) {
      lines.push("Current obstacle");
      lines.push(`- ${model.standing.currentObstacle}`);
    }

    if (model.standing.currentAssumption !== null) {
      lines.push("Aram's current assumption");
      lines.push(`- ${model.standing.currentAssumption}`);
    }

    sections.push(lines.join("\n"));
  }

  if (model.nextSteps.length > 0) {
    sections.push(
      `Sensible next steps\n${model.nextSteps
        .map((step, index) => `${index + 1}. ${step.text}\nWhy: ${step.why}`)
        .join("\n")}`,
    );
  }

  if (model.whatYouShouldntDo.length > 0) {
    sections.push(
      `What you shouldn't do\n${model.whatYouShouldntDo.join("\n")}`,
    );
  }

  if (model.evidence.count > 0) {
    const previewLine = formatEvidencePreviewLine(model.evidence);
    sections.push(
      previewLine === null
        ? `Evidence identified · ${model.evidence.count}`
        : `Evidence identified · ${model.evidence.count}\n${previewLine}`,
    );
  }

  if (model.legalPosition.ready) {
    sections.push(
      "Your legal position\nAram will add a grounded legal position here once sources can be checked. Nothing here is a legal conclusion yet.",
    );
  }

  if (model.helpNext.length > 0) {
    sections.push(
      `Aram can help you next\n${model.helpNext.map((item) => item.label).join("\n")}`,
    );
  }

  if (model.recommendedNextAction !== null) {
    const recommended = model.recommendedNextAction;
    const actionLine =
      recommended.action === null ? "" : `\n${recommended.action.label} →`;
    sections.push(`Recommended next action\n${recommended.summary}${actionLine}`);
  }

  return sections.join("\n\n");
}

export function formatEvidencePreviewLine(evidence: EvidenceSummary): string | null {
  if (evidence.count === 0 || evidence.preview.length === 0) {
    return null;
  }

  const remainder = evidence.count - evidence.preview.length;
  const joined = evidence.preview.join(", ");
  return remainder > 0 ? `${joined} +${remainder}` : joined;
}

export function orientationContainsLegalCopy(value: string): boolean {
  return LEGAL_COPY_PATTERN.test(value);
}

export function escalationClosedCopy(): string {
  return CLOSED_ACTION_MESSAGE;
}

export function selectRecommendedNextAction(
  steps: ActionableNextStep[],
  description: string,
): RecommendedNextAction | null {
  if (steps.length === 0) {
    return null;
  }

  const unresolved = steps.filter((step) => !isNextStepResolved(step, description));
  const pool = unresolved.length > 0 ? unresolved : steps;
  const recommended =
    pool.find((step) => step.action !== null) ?? pool[0] ?? null;

  if (recommended === null) {
    return null;
  }

  return {
    stepId: recommended.id,
    summary: recommendedSummaryFor(recommended),
    action: recommended.action,
  };
}

function recommendedSummaryFor(step: ActionableNextStep): string {
  switch (step.id) {
    case "refund-status":
      return "Based on what you've shared, the most useful next step is to put the refund request in writing before escalating further.";
    case "return-inspection":
      return "Based on what you've shared, the most useful next step is to confirm whether return inspection is complete.";
    case "deposit-reason":
      return "Based on what you've shared, the most useful next step is to put a written request for the deposit return.";
    case "deposit-itemised":
      return "Based on what you've shared, the most useful next step is to get an itemised list of any claimed deductions in writing.";
    case "salary-deduction":
      return "Based on what you've shared, the most useful next step is to get an itemised written breakdown of the salary deduction.";
    default: {
      const phrase = step.text.replace(/\.$/, "");
      const lowered = `${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;
      return `Based on what you've shared, the most useful next step is to ${lowered}.`;
    }
  }
}

function helpNextFrom(nextSteps: ActionableNextStep[]): HelpNextCapability[] {
  const alreadyOnSteps = new Set(
    nextSteps.flatMap((step) => (step.action === null ? [] : [step.action.label])),
  );
  const additional: HelpNextCapability[] = [];

  return additional.filter((capability) => !alreadyOnSteps.has(capability.label));
}

function draftsForSteps(steps: ActionableNextStep[]): Record<string, string> {
  const drafts: Record<string, string> = {};

  for (const step of steps) {
    if (step.action?.kind !== "show-draft") {
      continue;
    }

    const copy = draftCopyFor(step.action.draftId);

    if (copy !== null && !LEGAL_COPY_PATTERN.test(copy)) {
      drafts[step.action.draftId] = copy;
    }
  }

  return drafts;
}

function buildWhatsHappening(
  description: string,
  understanding: SituationUnderstanding,
): string {
  const factSentences = understanding.userFacts
    .map((fact) => fact.text.trim())
    .filter(
      (text) =>
        text.length > 0 &&
        !GENERIC_FACT_PATTERN.test(text) &&
        !LEGAL_COPY_PATTERN.test(text),
    );
  if (factSentences.length > 0) {
    return factSentences.slice(0, 3).join(" ");
  }

  const interpreted = interpretWhatsHappening(description);

  if (interpreted !== null && interpreted.length > 0) {
    return interpreted;
  }

  return contentSentences(description).slice(0, 3).join(" ");
}

function buildAssumptions(understanding: SituationUnderstanding): string[] {
  return uniqueTexts(
    understanding.assumptions
      .filter((assumption) => assumption.confidence === "high")
      .map((assumption) => formatAssumption(assumption))
      .filter((text) => text.length > 0 && !LEGAL_COPY_PATTERN.test(text)),
  ).slice(0, 4);
}

function formatAssumption(assumption: {
  text: string;
  because?: string;
}): string {
  const text = assumption.text.trim();

  if (text.length === 0) {
    return "";
  }

  if (assumption.because && assumption.because.trim().length > 0) {
    if (/\bbecause\b/i.test(text)) {
      return text;
    }

    return `${text} because you mentioned ${assumption.because.trim()}`;
  }

  return text;
}

function contentSentences(description: string): string[] {
  return splitPlainSentences(description).filter(
    (sentence) =>
      !GENERIC_WANT_PATTERN.test(sentence) &&
      !GENERIC_THEME_PATTERN.test(sentence) &&
      !URL_PATTERN.test(sentence) &&
      !LEGAL_COPY_PATTERN.test(sentence),
  );
}

function splitPlainSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function uniqueTexts(items: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const item of items) {
    const key = item.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}
