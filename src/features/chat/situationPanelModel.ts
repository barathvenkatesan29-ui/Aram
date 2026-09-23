import type { SituationUnderstanding, StoredQuestion } from "../../types/situationUnderstanding.ts";
import { toDetailsWorkspaceModel } from "./detailsWorkspaceModel.ts";

export type FriendlySituationPanel = {
  summary: string[];
  whatHappened: string[];
  peopleInvolved: string[];
  moneyInvolved: string[];
  timeline: string[];
  evidence: string[];
  whatYouWant: string[];
  stillUnclear: string[];
};

export function toFriendlySituationPanel(input: {
  description?: string;
  understanding: SituationUnderstanding;
  questions?: StoredQuestion[];
}): FriendlySituationPanel {
  const details = toDetailsWorkspaceModel({
    description: input.description ?? "",
    understanding: input.understanding,
  });

  return {
    summary: details.overview,
    whatHappened: details.importantFacts,
    peopleInvolved: details.people,
    moneyInvolved: details.money,
    timeline: details.timeline,
    evidence: details.evidence,
    whatYouWant: [],
    stillUnclear: details.stillUnclear,
  };
}
