import type {
  ProviderAvailability,
  StoredAnalysisView,
  StoredQuestion,
} from "../../types/situationUnderstanding.ts";
import {
  projectOrientationModel,
  type OrientationModel,
} from "./orientationModel.ts";
import { isIntelligenceReady } from "./provisionalNarrative.ts";
import { projectOrientation } from "./projectOrientation.ts";

export type ProjectedAramTurn = {
  body: string;
  orientation: OrientationModel | null;
};

export function projectAramTurn(input: {
  description: string;
  availability: ProviderAvailability;
  view: StoredAnalysisView;
}): ProjectedAramTurn {
  if (!isIntelligenceReady(input.description)) {
    return {
      body: "Please describe a little more about what happened.",
      orientation: null,
    };
  }

  if (input.view.kind === "understood") {
    const orientation = projectOrientationModel({
      description: input.description,
      understanding: input.view.understanding,
    });

    return {
      body: projectOrientation(input.view.understanding, input.description),
      orientation,
    };
  }

  if (input.availability === "unavailable") {
    return { body: "Understanding unavailable.", orientation: null };
  }

  if (input.view.kind === "unrenderable") {
    return { body: "This understanding could not be shown.", orientation: null };
  }

  if (input.view.kind === "could-not-understand") {
    return {
      body: "Could not understand this situation. You can add a little more detail.",
      orientation: null,
    };
  }

  if (input.view.kind === "out-of-date") {
    return {
      body: "This understanding is out of date because the saved description has changed.",
      orientation: null,
    };
  }

  return {
    body: "I will organise this as soon as there is enough to work with.",
    orientation: null,
  };
}

export function firstPendingQuestion(
  questions: StoredQuestion[],
): StoredQuestion | null {
  const pendingQuestions = questions
    .filter((question) => question.status === "pending")
    .sort((left, right) => left.position - right.position);

  return pendingQuestions[0] ?? null;
}

export function shouldAttemptInitialUnderstanding(input: {
  description: string;
  isFrozen: boolean;
}): boolean {
  return input.isFrozen === false && isIntelligenceReady(input.description);
}

export function shouldAppendPreUnderstanding(isFrozen: boolean): boolean {
  return isFrozen === false;
}

export function frozenComposerBody(): string {
  return "I have organised what you have shared so far.";
}
