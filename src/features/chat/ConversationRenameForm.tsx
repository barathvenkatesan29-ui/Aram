"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { renameConversation } from "./actions";
import {
  MAX_CONVERSATION_TITLE_LENGTH,
  validateConversationTitle,
} from "./conversationManagement";
import {
  conversationDisplayTitle,
  type ConversationListItem,
} from "./groupConversations";

type ConversationRenameFormProps = {
  conversation: ConversationListItem;
  onClose: () => void;
};

export function ConversationRenameForm({
  conversation,
  onClose,
}: ConversationRenameFormProps) {
  const router = useRouter();
  const [titleDraft, setTitleDraft] = useState(currentTitle(conversation));
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isWorking) {
      return;
    }

    const validation = validateConversationTitle(titleDraft);

    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    setIsWorking(true);
    setMessage(null);
    const result = await renameConversation(conversation.id, validation.title);
    setIsWorking(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    onClose();
    router.refresh();
  }

  function handleCancel() {
    if (isWorking) {
      return;
    }

    onClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }

  return (
    <form className="flex w-full flex-col gap-1 px-2 py-2" onSubmit={handleSave}>
      <label htmlFor={inputId} className="sr-only">
        Conversation name
      </label>
      <input
        ref={inputRef}
        id={inputId}
        value={titleDraft}
        onChange={(event) => setTitleDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_CONVERSATION_TITLE_LENGTH}
        aria-invalid={message !== null}
        aria-describedby={message ? errorId : undefined}
        className="w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 focus:border-teal-800 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isWorking}
          className="text-xs font-medium text-teal-800 hover:text-teal-900"
        >
          Save
        </button>
        <button
          type="button"
          disabled={isWorking}
          onClick={handleCancel}
          className="text-xs font-medium text-stone-600 hover:text-stone-900"
        >
          Cancel
        </button>
      </div>
      {message ? (
        <p id={errorId} role="alert" className="text-xs text-red-800">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function currentTitle(conversation: ConversationListItem): string {
  const storedTitle = conversation.title?.trim() ?? "";

  if (storedTitle.length > 0) {
    return storedTitle;
  }

  return conversationDisplayTitle(conversation);
}
