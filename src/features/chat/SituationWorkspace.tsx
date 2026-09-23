"use client";

import { useState } from "react";
import { BrowserWorkspace } from "./BrowserWorkspace";
import {
  PanelCollapseButton,
  useChatPanelLayout,
} from "./ChatPanelLayout";
import { DetailsPanel } from "./DetailsPanel";
import type { DetailsLink, DetailsWorkspaceModel } from "./detailsWorkspaceModel";
import type { BrowserTab } from "./browserTabs";

type RightWorkspaceTab = "details" | "browser";

type SituationWorkspaceProps = {
  model: DetailsWorkspaceModel | null;
  emptyCopy: string;
  expandedSections: ReadonlySet<string>;
  onToggleSection: (id: string) => void;
  onOpenLink: (link: DetailsLink) => void;
  browserTabs: BrowserTab[];
  activeBrowserTabId: string | null;
  workspaceTab: RightWorkspaceTab;
  onWorkspaceTab: (tab: RightWorkspaceTab) => void;
  onSelectBrowserTab: (tabId: string) => void;
  onCloseBrowserTab: (tabId: string) => void;
};

export function SituationWorkspace({
  model,
  emptyCopy,
  expandedSections,
  onToggleSection,
  onOpenLink,
  browserTabs,
  activeBrowserTabId,
  workspaceTab,
  onWorkspaceTab,
  onSelectBrowserTab,
  onCloseBrowserTab,
}: SituationWorkspaceProps) {
  const layout = useChatPanelLayout();

  return (
    <aside
      aria-label="Workspace"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-3 py-2">
        <div role="tablist" aria-label="Workspace" className="flex gap-1">
          <WorkspaceTabButton
            selected={workspaceTab === "details"}
            onClick={() => onWorkspaceTab("details")}
          >
            Details
          </WorkspaceTabButton>
          <WorkspaceTabButton
            selected={workspaceTab === "browser"}
            onClick={() => onWorkspaceTab("browser")}
          >
            Browser
          </WorkspaceTabButton>
        </div>
        <PanelCollapseButton which="right" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {workspaceTab === "details" ? (
          <div className="h-full overflow-x-hidden overflow-y-auto px-4 py-4">
            <DetailsPanel
              model={model}
              emptyCopy={emptyCopy}
              width={layout.overlay ? 360 : layout.rightWidth}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
              onOpenLink={onOpenLink}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-4">
            <BrowserWorkspace
              tabs={browserTabs}
              activeId={activeBrowserTabId}
              onSelect={onSelectBrowserTab}
              onClose={onCloseBrowserTab}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function WorkspaceTabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm ${
        selected
          ? "bg-stone-900 font-medium text-white"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      {children}
    </button>
  );
}

export function EmptySituationWorkspace() {
  const [workspaceTab, setWorkspaceTab] = useState<"details" | "browser">("details");
  const [expanded] = useState<ReadonlySet<string>>(new Set());

  return (
    <SituationWorkspace
      model={null}
      emptyCopy="Aram will organise what you share here after there is enough to work with."
      expandedSections={expanded}
      onToggleSection={() => undefined}
      onOpenLink={() => undefined}
      browserTabs={[]}
      activeBrowserTabId={null}
      workspaceTab={workspaceTab}
      onWorkspaceTab={setWorkspaceTab}
      onSelectBrowserTab={() => undefined}
      onCloseBrowserTab={() => undefined}
    />
  );
}
