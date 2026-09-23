"use client";

import { useState } from "react";
import { closeBrowserTab, openOrReuseBrowserTab, type BrowserTab } from "./browserTabs";
import { ConversationChat } from "./ConversationChat";
import { PanelDivider, RightPanelShell } from "./ChatPanelLayout";
import type { ConversationAction } from "./orientationModel";
import type { DetailsLink, DetailsWorkspaceModel } from "./detailsWorkspaceModel";
import type { ClarificationCarouselView } from "./optionalClarification";
import type { ProjectedAramTurn } from "./projectAramTurn";
import { SituationWorkspace } from "./SituationWorkspace";
import type { UserChatMessage } from "./listUserMessages";

type RightWorkspaceTab = "details" | "browser";

type ConversationWorkspaceProps = {
  heading: string;
  caseId: string;
  messages: UserChatMessage[];
  aramTurn: ProjectedAramTurn;
  frozen: boolean;
  clarification: ClarificationCarouselView | null;
  details: DetailsWorkspaceModel | null;
  detailsEmptyCopy: string;
};

export function ConversationWorkspace({
  heading,
  caseId,
  messages,
  aramTurn,
  frozen,
  clarification,
  details,
  detailsEmptyCopy,
}: ConversationWorkspaceProps) {
  const [workspaceTab, setWorkspaceTab] = useState<RightWorkspaceTab>("details");
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([]);
  const [activeBrowserTabId, setActiveBrowserTabId] = useState<string | null>(null);

  function handleAction(action: ConversationAction) {
    if (action.id === "view-evidence") {
      setWorkspaceTab("details");
      setExpandedSections((current) => new Set([...current, "evidence"]));
      return;
    }

    if (action.id === "open-verified-source") {
      handleOpenLink({
        url: action.url,
        title: action.title,
        provenance: "user-supplied",
      });
    }
  }

  function handleOpenLink(link: DetailsLink) {
    const next = openOrReuseBrowserTab(browserTabs, {
      url: link.url,
      title: link.title,
    });
    setBrowserTabs(next.tabs);
    setActiveBrowserTabId(next.activeId);
    setWorkspaceTab("browser");
  }

  function handleCloseBrowserTab(tabId: string) {
    const next = closeBrowserTab(browserTabs, tabId, activeBrowserTabId);
    setBrowserTabs(next.tabs);
    setActiveBrowserTabId(next.activeId);

    if (next.tabs.length === 0) {
      setWorkspaceTab("details");
    }
  }

  function handleToggleSection(id: string) {
    setExpandedSections((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-50">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <h1 className="min-w-0 truncate text-sm font-semibold text-stone-900">{heading}</h1>
        </header>
        <ConversationChat
          caseId={caseId}
          messages={messages}
          aramTurn={aramTurn}
          frozen={frozen}
          clarification={clarification}
          onAction={handleAction}
        />
      </section>
      <PanelDivider which="right" />
      <RightPanelShell>
        <SituationWorkspace
          model={details}
          emptyCopy={detailsEmptyCopy}
          expandedSections={expandedSections}
          onToggleSection={handleToggleSection}
          onOpenLink={handleOpenLink}
          browserTabs={browserTabs}
          activeBrowserTabId={activeBrowserTabId}
          workspaceTab={workspaceTab}
          onWorkspaceTab={setWorkspaceTab}
          onSelectBrowserTab={setActiveBrowserTabId}
          onCloseBrowserTab={handleCloseBrowserTab}
        />
      </RightPanelShell>
    </div>
  );
}
