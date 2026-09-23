import type { SituationUnderstanding } from "../../types/situationUnderstanding.ts";
import { extractEvidenceItems } from "../situation-understanding/situationFromDescription.ts";
import {
  projectOrientationModel,
  type ConversationAction,
  type OrientationModel,
} from "./orientationModel.ts";

export type ProvenanceKind = "user-supplied" | "aram-understood" | "aram-created";

export type DetailsLink = {
  url: string;
  title: string;
  provenance: "user-supplied";
};

export type DetailsAttachment = {
  name: string;
  provenance: "user-supplied";
};

export type DetailsWorkspaceModel = {
  overview: string[];
  keyDetails: string[];
  people: string[];
  money: string[];
  timeline: string[];
  importantFacts: string[];
  evidence: string[];
  attachments: DetailsAttachment[];
  links: DetailsLink[];
  stillUnclear: string[];
  assumptions: string[];
  actions: ConversationAction[];
  orientation: OrientationModel;
};

const MONEY_PATTERN =
  /₹|\b(rs\.?|inr|rupee|rupees|lakh|lakhs|crore|deposit|rent|salary|amount|paid|owe)\b/i;
const TIME_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|today|yesterday|\d{4}|last week|last month)\b/i;
const URL_PATTERN = /https?:\/\/[^\s)\]>'"]+/gi;

export function toDetailsWorkspaceModel(input: {
  description: string;
  understanding: SituationUnderstanding;
}): DetailsWorkspaceModel {
  const orientation = projectOrientationModel(input);
  const sentences = splitPlainSentences(input.description);
  const importantFacts = input.understanding.userFacts
    .map((fact) => fact.text.trim())
    .filter((text) => text.length > 0 && !/the user described a situation/i.test(text));
  const sourceSentences = importantFacts.length > 0 ? importantFacts : sentences;

  return {
    overview:
      orientation.whatsHappening.length > 0 ? [orientation.whatsHappening] : [],
    keyDetails: orientation.standing.inYourFavour,
    people: input.understanding.parties.map(
      (party) => `${party.label} — ${party.role}`,
    ),
    money: sourceSentences.filter((text) => MONEY_PATTERN.test(text)),
    timeline: sourceSentences.filter((text) => TIME_PATTERN.test(text)),
    importantFacts,
    evidence: extractEvidenceItems(input.description),
    attachments: [],
    links: linksFromDescription(input.description),
    stillUnclear: orientation.stillUnclear,
    assumptions: orientation.assumptions,
    actions: [],
    orientation,
  };
}

export function linksFromDescription(description: string): DetailsLink[] {
  const links: DetailsLink[] = [];
  const seen = new Set<string>();

  for (const raw of description.match(URL_PATTERN) ?? []) {
    const parsed = parseHttpUrl(raw);

    if (parsed === null || seen.has(parsed.url)) {
      continue;
    }

    seen.add(parsed.url);
    links.push({
      url: parsed.url,
      title: parsed.title,
      provenance: "user-supplied",
    });
  }

  return links;
}

export function parseHttpUrl(raw: string): { url: string; title: string } | null {
  try {
    const url = new URL(raw);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const host = url.hostname.replace(/^www\./, "");
    return {
      url: url.toString(),
      title: host.length > 0 ? host : url.toString(),
    };
  } catch {
    return null;
  }
}

function splitPlainSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
