"use client";

import Link from "next/link";
import { useState } from "react";
import { ConversationMenu } from "./ConversationMenu";
import { ConversationRenameForm } from "./ConversationRenameForm";
import {
  conversationDisplayTitle,
  type ConversationListItem,
} from "./groupConversations";

type ConversationRowProps = {
  conversation: ConversationListItem;
  href: string;
  isActive: boolean;
  variant: "active" | "archived";
  isCurrent: boolean;
};

export function ConversationRow({
  conversation,
  href,
  isActive,
  variant,
  isCurrent,
}: ConversationRowProps) {
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <div className={`rounded-lg ${isActive ? "bg-white" : ""}`}>
        <ConversationRenameForm
          conversation={conversation}
          onClose={() => setRenaming(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-1 rounded-lg ${
        isActive ? "bg-white" : "hover:bg-white"
      }`}
    >
      <Link
        href={href}
        className={`min-w-0 flex-1 truncate px-2 py-2 text-sm ${
          isActive ? "font-medium text-teal-900" : "text-stone-700"
        }`}
      >
        {conversationDisplayTitle(conversation)}
      </Link>
      <div className="pt-1 pr-1">
        <ConversationMenu
          conversation={conversation}
          variant={variant}
          isCurrent={isCurrent}
          onRename={() => setRenaming(true)}
        />
      </div>
    </div>
  );
}
