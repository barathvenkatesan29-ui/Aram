"use client";

import { ConversationRow } from "./ConversationRow";
import type { ConversationListItem } from "./groupConversations";

type ArchivedConversationListProps = {
  conversations: ConversationListItem[];
};

export function ArchivedConversationList({
  conversations,
}: ArchivedConversationListProps) {
  if (conversations.length === 0) {
    return (
      <p className="leading-7 text-stone-600">
        You have no archived conversations.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {conversations.map((conversation) => (
        <li
          key={conversation.id}
          className="rounded-xl border border-stone-200 bg-white px-1 py-1"
        >
          <ConversationRow
            conversation={conversation}
            href={`/chat/${conversation.id}`}
            isActive={false}
            variant="archived"
            isCurrent={false}
          />
        </li>
      ))}
    </ul>
  );
}
