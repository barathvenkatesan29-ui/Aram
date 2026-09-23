"use client";

import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { ClarificationCarousel } from "./ClarificationCarousel";
import { type ConversationAction } from "./orientationModel";
import type { ClarificationCarouselView } from "./optionalClarification";
import type { ProjectedAramTurn } from "./projectAramTurn";
import type { UserChatMessage } from "./listUserMessages";

type ConversationChatProps = {
  caseId: string;
  messages: UserChatMessage[];
  aramTurn: ProjectedAramTurn;
  frozen: boolean;
  clarification: ClarificationCarouselView | null;
  onAction?: (action: ConversationAction) => void;
};

export function ConversationChat({
  caseId,
  messages,
  aramTurn,
  frozen,
  clarification,
  onAction,
}: ConversationChatProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatThread
        messages={messages}
        aramTurn={aramTurn}
        scrollKey={caseId}
        emptyCopy="Describe what happened in your own words."
        precisionSlot={
          frozen && clarification !== null ? (
            <ClarificationCarousel caseId={caseId} carousel={clarification} embedded />
          ) : null
        }
        onStepAction={onAction}
      />
      <div className="shrink-0 border-t border-stone-200 bg-white">
        <ChatComposer caseId={caseId} frozen={frozen} />
      </div>
    </div>
  );
}
