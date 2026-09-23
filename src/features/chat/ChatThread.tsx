"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { UserChatMessage } from "./listUserMessages";
import { OrientationCard } from "./OrientationCard";
import type { ConversationAction } from "./orientationModel";
import type { ProjectedAramTurn } from "./projectAramTurn";

const transcriptScrollTop = new Map<string, number>();

type ChatThreadProps = {
  messages: UserChatMessage[];
  aramTurn: ProjectedAramTurn | null;
  emptyCopy: string;
  scrollKey?: string;
  precisionSlot?: ReactNode;
  onStepAction?: (action: ConversationAction) => void;
  notice?: ReactNode;
};

export function ChatThread({
  messages,
  aramTurn,
  emptyCopy,
  scrollKey = "new-chat",
  precisionSlot,
  onStepAction,
  notice,
}: ChatThreadProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;

    if (scroller === null) {
      return;
    }

    const transcript: HTMLDivElement = scroller;

    function restore() {
      const saved = transcriptScrollTop.get(scrollKey);

      if (saved !== undefined) {
        transcript.scrollTop = saved;
      }
    }

    function persist() {
      transcriptScrollTop.set(scrollKey, transcript.scrollTop);
    }

    restore();
    transcript.addEventListener("scroll", persist, { passive: true });

    const observer = new ResizeObserver(() => {
      restore();
    });
    observer.observe(transcript);

    return () => {
      persist();
      transcript.removeEventListener("scroll", persist);
      observer.disconnect();
    };
  }, [scrollKey]);

  return (
    <div
      ref={scrollerRef}
      id="conversation-transcript"
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [overflow-anchor:none]"
    >
      {messages.length === 0 ? (
        <div className="flex min-h-full flex-col justify-end px-4 py-6">
          <p className="leading-7 text-stone-600">{emptyCopy}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-6">
          {messages.map((message) => (
            <article
              key={message.id}
              className="ml-auto max-w-[85%] rounded-2xl bg-teal-800 px-4 py-3 text-white"
            >
              <p className="min-w-0 whitespace-pre-wrap break-words leading-7">
                {message.body}
              </p>
            </article>
          ))}
          {aramTurn ? (
            <article className="mr-auto w-full min-w-0 max-w-2xl rounded-2xl border border-stone-200 bg-white px-5 py-5 text-stone-900">
              {aramTurn.orientation ? (
                <OrientationCard
                  model={aramTurn.orientation}
                  onStepAction={onStepAction}
                  precisionSlot={precisionSlot}
                  notice={notice}
                />
              ) : (
                <p className="min-w-0 whitespace-pre-wrap break-words leading-7">
                  {aramTurn.body}
                </p>
              )}
            </article>
          ) : null}
        </div>
      )}
    </div>
  );
}
