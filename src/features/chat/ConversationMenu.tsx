"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  archiveConversation,
  deleteConversation,
  unarchiveConversation,
} from "./actions";
import {
  conversationDisplayTitle,
  type ConversationListItem,
} from "./groupConversations";

type ConversationMenuProps = {
  conversation: ConversationListItem;
  variant: "active" | "archived";
  isCurrent: boolean;
  onRename: () => void;
};

export function ConversationMenu({
  conversation,
  variant,
  isCurrent,
  onRename,
}: ConversationMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  async function handleArchiveToggle() {
    if (isWorking) {
      return;
    }

    setIsWorking(true);
    setMessage(null);
    const result =
      variant === "archived"
        ? await unarchiveConversation(conversation.id)
        : await archiveConversation(conversation.id);
    setIsWorking(false);
    setMenuOpen(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    router.refresh();
  }

  async function handleDelete() {
    if (isWorking) {
      return;
    }

    setIsWorking(true);
    setMessage(null);
    const result = await deleteConversation(conversation.id);
    setIsWorking(false);

    if (!result.ok) {
      setMessage(result.message);
      setConfirmingDelete(false);
      return;
    }

    if (isCurrent) {
      router.push("/chat");
      return;
    }

    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={`More actions for ${conversationDisplayTitle(conversation)}`}
        onClick={() => {
          setMenuOpen((open) => !open);
          setConfirmingDelete(false);
          setMessage(null);
        }}
        className="rounded-md px-1.5 py-0.5 text-sm leading-none text-stone-500 hover:bg-white hover:text-stone-900"
      >
        •••
      </button>
      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-36 rounded-lg border border-stone-200 bg-white py-1 shadow-sm"
        >
          {confirmingDelete ? (
            <div className="flex flex-col gap-2 px-3 py-2">
              <p className="text-xs leading-5 text-stone-700">
                Delete this conversation permanently? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  role="menuitem"
                  disabled={isWorking}
                  onClick={() => {
                    void handleDelete();
                  }}
                  className="text-xs font-medium text-red-800 hover:text-red-900"
                >
                  Delete
                </button>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem
                disabled={isWorking}
                onSelect={() => {
                  setMenuOpen(false);
                  onRename();
                }}
              >
                Rename
              </MenuItem>
              <MenuItem disabled={isWorking} onSelect={() => void handleArchiveToggle()}>
                {variant === "archived" ? "Restore" : "Archive"}
              </MenuItem>
              <MenuItem
                disabled={isWorking}
                onSelect={() => setConfirmingDelete(true)}
              >
                Delete
              </MenuItem>
            </>
          )}
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="absolute right-0 top-full z-20 mt-1 w-40 text-xs text-red-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  disabled,
  onSelect,
}: {
  children: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:text-stone-400"
    >
      {children}
    </button>
  );
}
