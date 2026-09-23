"use client";

import type { ReactNode } from "react";
import type { ConversationListItem } from "./groupConversations";
import { ConversationSidebar } from "./ConversationSidebar";
import {
  ChatPanelLayoutProvider,
  LeftPanelShell,
  OverlayPanelButtons,
  PanelCollapseButton,
  PanelDivider,
} from "./ChatPanelLayout";

type ChatShellProps = {
  conversations: ConversationListItem[];
  archivedCount: number;
  listFailed: boolean;
  children: ReactNode;
};

export function ChatShell({
  conversations,
  archivedCount,
  listFailed,
  children,
}: ChatShellProps) {
  return (
    <ChatPanelLayoutProvider>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <LeftPanelShell>
          <ConversationSidebar
            conversations={conversations}
            archivedCount={archivedCount}
            listFailed={listFailed}
            headerAction={<PanelCollapseButton which="left" />}
          />
        </LeftPanelShell>
        <PanelDivider which="left" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <OverlayPanelButtons />
          {children}
        </div>
      </div>
    </ChatPanelLayoutProvider>
  );
}
