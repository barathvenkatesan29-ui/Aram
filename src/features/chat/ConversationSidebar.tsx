"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConversationRow } from "./ConversationRow";
import {
  groupConversationsByRecency,
  type ConversationListItem,
} from "./groupConversations";

type ConversationSidebarProps = {
  conversations: ConversationListItem[];
  archivedCount: number;
  listFailed: boolean;
  headerAction?: ReactNode;
};

export function ConversationSidebar({
  conversations,
  archivedCount,
  listFailed,
  headerAction,
}: ConversationSidebarProps) {
  const pathname = usePathname();
  const groups = groupConversationsByRecency(conversations);
  const archivedActive = pathname === "/chat/archived";

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-stone-200 bg-stone-50">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-3 py-3">
        <h2 className="text-sm font-semibold text-stone-900">Conversations</h2>
        <div className="flex items-center gap-1">
          <Link
            href="/chat"
            className="inline-flex h-9 items-center justify-center rounded-full bg-teal-800 px-3 text-sm font-medium text-white hover:bg-teal-900"
          >
            New chat
          </Link>
          {headerAction}
        </div>
      </div>
      <nav
        aria-label="Conversation history"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2"
      >
        {listFailed ? (
          <p role="alert" className="px-2 py-2 text-sm text-red-800">
            We could not load your conversations. Please try again.
          </p>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-2 text-sm leading-6 text-stone-600">
            Your conversations will appear here after you send the first message.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-3">
              <h3 className="px-2 py-1 text-xs font-medium tracking-wide text-stone-500 uppercase">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.conversations.map((conversation) => {
                  const href = `/chat/${conversation.id}`;
                  const isActive = pathname === href;

                  return (
                    <li key={conversation.id}>
                      <ConversationRow
                        conversation={conversation}
                        href={href}
                        isActive={isActive}
                        variant="active"
                        isCurrent={isActive}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>
      <div className="shrink-0 border-t border-stone-200 px-2 py-2">
        <Link
          href="/chat/archived"
          className={`block rounded-lg px-2 py-2 text-sm ${
            archivedActive
              ? "bg-white font-medium text-teal-900"
              : "text-stone-600 hover:bg-white hover:text-stone-900"
          }`}
        >
          Archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
        </Link>
      </div>
    </aside>
  );
}
