"use client";

import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { PanelDivider, RightPanelShell } from "./ChatPanelLayout";
import { EmptySituationWorkspace } from "./SituationWorkspace";

export function NewChatWorkspace() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-50">
        <ChatThread
          messages={[]}
          aramTurn={null}
          scrollKey="new-chat"
          emptyCopy="Start by describing what happened. A short first message is enough to open a conversation. Aram will organise it once there is a little more to work with."
        />
        <div className="shrink-0 border-t border-stone-200 bg-white">
          <ChatComposer caseId={null} frozen={false} />
        </div>
      </section>
      <PanelDivider which="right" />
      <RightPanelShell>
        <EmptySituationWorkspace />
      </RightPanelShell>
    </div>
  );
}
