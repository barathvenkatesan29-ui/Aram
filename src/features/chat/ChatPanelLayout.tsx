"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  clampLeftWidth,
  clampRightWidth,
  LEFT_PANEL_DEFAULT,
  LEFT_WIDTH_STORAGE_KEY,
  overlayBreakpoint,
  RIGHT_PANEL_DEFAULT,
  RIGHT_WIDTH_STORAGE_KEY,
  shouldUseOverlay,
} from "./panelWidth";

type ChatPanelLayoutContextValue = {
  overlay: boolean;
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  rightPresent: boolean;
  setLeftCollapsed: (collapsed: boolean) => void;
  setRightCollapsed: (collapsed: boolean) => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setRightDrawerOpen: (open: boolean) => void;
  resizeLeft: (proposed: number) => void;
  resizeRight: (proposed: number) => void;
  resetLeft: () => void;
  resetRight: () => void;
};

const ChatPanelLayoutContext = createContext<ChatPanelLayoutContextValue | null>(
  null,
);

const widthListeners = new Map<string, Set<() => void>>();

function readStoredWidth(key: string, fallback: number): number {
  const raw = window.localStorage.getItem(key);

  if (raw === null) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function subscribeStoredWidth(key: string) {
  return (onStoreChange: () => void) => {
    let listeners = widthListeners.get(key);

    if (!listeners) {
      listeners = new Set();
      widthListeners.set(key, listeners);
    }

    listeners.add(onStoreChange);

    function onStorage(event: StorageEvent) {
      if (event.key === key) {
        onStoreChange();
      }
    }

    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener("storage", onStorage);
    };
  };
}

function writeStoredWidth(key: string, value: number) {
  window.localStorage.setItem(key, String(value));
  widthListeners.get(key)?.forEach((listener) => listener());
}

function useStoredWidth(key: string, fallback: number): number {
  return useSyncExternalStore(
    subscribeStoredWidth(key),
    () => readStoredWidth(key, fallback),
    () => fallback,
  );
}

function useViewportWidth(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => window.innerWidth,
    () => overlayBreakpoint(),
  );
}

export function ChatPanelLayoutProvider({ children }: { children: ReactNode }) {
  const viewportWidth = useViewportWidth();
  const storedLeftWidth = useStoredWidth(LEFT_WIDTH_STORAGE_KEY, LEFT_PANEL_DEFAULT);
  const storedRightWidth = useStoredWidth(RIGHT_WIDTH_STORAGE_KEY, RIGHT_PANEL_DEFAULT);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const pathname = usePathname();
  const rightPresent = pathname !== "/chat/archived";

  const overlay = shouldUseOverlay(viewportWidth);
  const leftWidth = clampLeftWidth({
    proposed: storedLeftWidth,
    rightWidth: storedRightWidth,
    viewportWidth,
  });
  const rightWidth = clampRightWidth({
    proposed: storedRightWidth,
    leftWidth,
    viewportWidth,
  });

  const resizeLeft = useCallback(
    (proposed: number) => {
      const next = clampLeftWidth({
        proposed,
        rightWidth: rightCollapsed ? 0 : rightWidth,
        viewportWidth,
      });
      writeStoredWidth(LEFT_WIDTH_STORAGE_KEY, next);
    },
    [rightCollapsed, rightWidth, viewportWidth],
  );

  const resizeRight = useCallback(
    (proposed: number) => {
      const next = clampRightWidth({
        proposed,
        leftWidth: leftCollapsed ? 0 : leftWidth,
        viewportWidth,
      });
      writeStoredWidth(RIGHT_WIDTH_STORAGE_KEY, next);
    },
    [leftCollapsed, leftWidth, viewportWidth],
  );

  const resetLeft = useCallback(() => {
    resizeLeft(LEFT_PANEL_DEFAULT);
  }, [resizeLeft]);

  const resetRight = useCallback(() => {
    resizeRight(RIGHT_PANEL_DEFAULT);
  }, [resizeRight]);

  const value = useMemo(
    () => ({
      overlay,
      leftWidth,
      rightWidth,
      leftCollapsed,
      rightCollapsed,
      leftDrawerOpen,
      rightDrawerOpen,
      rightPresent,
      setLeftCollapsed,
      setRightCollapsed,
      setLeftDrawerOpen,
      setRightDrawerOpen,
      resizeLeft,
      resizeRight,
      resetLeft,
      resetRight,
    }),
    [
      leftCollapsed,
      leftDrawerOpen,
      leftWidth,
      overlay,
      resetLeft,
      resetRight,
      resizeLeft,
      resizeRight,
      rightCollapsed,
      rightDrawerOpen,
      rightPresent,
      rightWidth,
    ],
  );

  return (
    <ChatPanelLayoutContext.Provider value={value}>
      {children}
    </ChatPanelLayoutContext.Provider>
  );
}

export function useChatPanelLayout(): ChatPanelLayoutContextValue {
  const value = useContext(ChatPanelLayoutContext);

  if (value === null) {
    throw new Error("useChatPanelLayout must be used within ChatPanelLayoutProvider");
  }

  return value;
}

export function PanelDivider({
  which,
}: {
  which: "left" | "right";
}) {
  const layout = useChatPanelLayout();

  if (layout.overlay) {
    return null;
  }

  const collapsed = which === "left" ? layout.leftCollapsed : layout.rightCollapsed;

  if (collapsed) {
    return null;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={which === "left" ? "Resize conversations panel" : "Resize details panel"}
      tabIndex={0}
      className="hidden w-2 shrink-0 cursor-col-resize bg-transparent hover:bg-teal-800/15 lg:block"
      onDoubleClick={() => {
        if (which === "left") {
          layout.resetLeft();
          return;
        }

        layout.resetRight();
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = which === "left" ? layout.leftWidth : layout.rightWidth;
        const pointerId = event.pointerId;
        const target = event.currentTarget;
        target.setPointerCapture(pointerId);

        function handleMove(moveEvent: PointerEvent) {
          const delta = moveEvent.clientX - startX;

          if (which === "left") {
            layout.resizeLeft(startWidth + delta);
            return;
          }

          layout.resizeRight(startWidth - delta);
        }

        function handleUp() {
          target.removeEventListener("pointermove", handleMove);
          target.removeEventListener("pointerup", handleUp);
          target.removeEventListener("pointercancel", handleUp);
        }

        target.addEventListener("pointermove", handleMove);
        target.addEventListener("pointerup", handleUp);
        target.addEventListener("pointercancel", handleUp);
      }}
    />
  );
}

export function LeftPanelShell({ children }: { children: ReactNode }) {
  const layout = useChatPanelLayout();

  if (layout.overlay) {
    if (!layout.leftDrawerOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-40 flex">
        <button
          type="button"
          aria-label="Close conversations"
          className="absolute inset-0 bg-stone-900/30"
          onClick={() => layout.setLeftDrawerOpen(false)}
        />
        <div className="relative z-10 flex h-full min-h-0 w-[min(20rem,90vw)] flex-col overflow-hidden bg-stone-50 shadow-xl">
          {children}
        </div>
      </div>
    );
  }

  if (layout.leftCollapsed) {
    return (
      <div className="hidden h-full w-10 shrink-0 flex-col items-center border-r border-stone-200 bg-stone-50 lg:flex">
        <button
          type="button"
          className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-white hover:text-stone-900"
          onClick={() => layout.setLeftCollapsed(false)}
          aria-label="Expand conversations"
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <div
      className="hidden h-full min-h-0 shrink-0 flex-col overflow-hidden lg:flex"
      style={{ width: layout.leftWidth, minWidth: layout.leftWidth }}
    >
      {children}
    </div>
  );
}

export function RightPanelShell({ children }: { children: ReactNode }) {
  const layout = useChatPanelLayout();

  if (!layout.rightPresent) {
    return null;
  }

  if (layout.overlay) {
    if (!layout.rightDrawerOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-40 flex justify-end">
        <button
          type="button"
          aria-label="Close details"
          className="absolute inset-0 bg-stone-900/30"
          onClick={() => layout.setRightDrawerOpen(false)}
        />
        <div className="relative z-10 flex h-full min-h-0 w-[min(24rem,90vw)] flex-col overflow-hidden bg-white shadow-xl">
          {children}
        </div>
      </div>
    );
  }

  if (layout.rightCollapsed) {
    return (
      <div className="hidden h-full w-10 shrink-0 flex-col items-center border-l border-stone-200 bg-white lg:flex">
        <button
          type="button"
          className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          onClick={() => layout.setRightCollapsed(false)}
          aria-label="Expand details"
        >
          ‹
        </button>
      </div>
    );
  }

  return (
    <div
      className="hidden h-full min-h-0 shrink-0 flex-col overflow-hidden lg:flex"
      style={{ width: layout.rightWidth, minWidth: layout.rightWidth }}
    >
      {children}
    </div>
  );
}

export function OverlayPanelButtons() {
  const layout = useChatPanelLayout();

  if (!layout.overlay) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
      <button
        type="button"
        className="inline-flex h-9 items-center justify-center rounded-full border border-stone-300 px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
        onClick={() => layout.setLeftDrawerOpen(true)}
      >
        Conversations
      </button>
      {layout.rightPresent ? (
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-full border border-stone-300 px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
          onClick={() => layout.setRightDrawerOpen(true)}
        >
          Details
        </button>
      ) : null}
    </div>
  );
}

export function PanelCollapseButton({ which }: { which: "left" | "right" }) {
  const layout = useChatPanelLayout();

  if (layout.overlay) {
    return null;
  }

  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      onClick={() => {
        if (which === "left") {
          layout.setLeftCollapsed(true);
          return;
        }

        layout.setRightCollapsed(true);
      }}
      aria-label={which === "left" ? "Collapse conversations" : "Collapse details"}
    >
      {which === "left" ? "‹" : "›"}
    </button>
  );
}
