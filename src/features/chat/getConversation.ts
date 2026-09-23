import { getCase } from "@/features/cases/getCase";
import { parseCaseId } from "@/features/cases/parseCaseId";
import { getLatestAnalysis } from "@/features/situation-understanding/getLatestAnalysis";
import { hasRevalidatedCurrentComplete } from "@/features/situation-understanding/selectAnalysisState";
import { getProvider } from "@/server/ai/getProvider";
import type { CaseRecord } from "@/types/case";
import type {
  AskabilityRecord,
  ProviderAvailability,
  StoredAnalysisView,
  StoredQuestion,
} from "@/types/situationUnderstanding";
import { toDetailsWorkspaceModel, type DetailsWorkspaceModel } from "./detailsWorkspaceModel";
import { listUserMessages, type UserChatMessage } from "./listUserMessages";
import { selectFinalisedClarifications } from "@/features/situation-understanding/decideOptionalClarification";
import type { ClarificationCardView, ClarificationCarouselView } from "./optionalClarification";
import {
  projectAramTurn,
  shouldAppendPreUnderstanding,
  type ProjectedAramTurn,
} from "./projectAramTurn";

export type ConversationView = {
  savedCase: CaseRecord;
  messages: UserChatMessage[];
  view: StoredAnalysisView;
  availability: ProviderAvailability;
  aramTurn: ProjectedAramTurn;
  details: DetailsWorkspaceModel | null;
  canAppend: boolean;
  clarification: ClarificationCarouselView | null;
};

export async function getConversation(
  rawCaseId: string,
): Promise<ConversationView | null> {
  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return null;
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    return null;
  }

  const messages = await listUserMessages(savedCase.id);

  if (!messages) {
    return null;
  }

  const latestAnalysis = await getLatestAnalysis(savedCase.id, savedCase.description);
  const availability: ProviderAvailability = getProvider().ok
    ? "available"
    : "unavailable";
  const aramTurn = projectAramTurn({
    description: savedCase.description,
    availability,
    view: latestAnalysis.view,
  });
  const details =
    latestAnalysis.view.kind === "understood"
      ? toDetailsWorkspaceModel({
          description: savedCase.description,
          understanding: latestAnalysis.view.understanding,
        })
      : null;

  return {
    savedCase,
    messages,
    view: latestAnalysis.view,
    availability,
    aramTurn,
    details,
    canAppend: shouldAppendPreUnderstanding(
      hasRevalidatedCurrentComplete(latestAnalysis.view),
    ),
    clarification: toClarificationCarousel({
      view: latestAnalysis.view,
      askability: latestAnalysis.askability,
    }),
  };
}

function toClarificationCarousel(input: {
  view: StoredAnalysisView;
  askability: AskabilityRecord | null;
}): ClarificationCarouselView | null {
  const keeps = selectFinalisedClarifications(input);

  if (keeps.length === 0) {
    return null;
  }

  const cards = keeps.map((question) => toClarificationCard(question, input.view));
  const currentIndex = cards.findIndex((card) => card.status === "pending");
  const current = currentIndex === -1 ? null : (cards[currentIndex] ?? null);
  const previous = cards.filter(
    (card) => card.status === "answered" || card.status === "skipped",
  );
  const remainingAfterCurrent =
    currentIndex === -1
      ? 0
      : cards.slice(currentIndex + 1).filter((card) => card.status === "pending").length;

  return {
    current,
    previous,
    remainingAfterCurrent,
  };
}

function toClarificationCard(
  question: StoredQuestion,
  view: StoredAnalysisView,
): ClarificationCardView {
  const options =
    view.kind === "understood"
      ? (view.understanding.questions.find(
          (candidate) => candidate.position === question.position,
        )?.suggested_options ?? [])
      : [];

  return {
    questionId: question.id,
    question: question.question,
    whyItMatters: question.why_it_matters,
    options,
    status: question.status,
    answer: question.answer,
  };
}
