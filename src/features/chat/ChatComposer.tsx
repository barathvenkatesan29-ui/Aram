"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { sendMessage } from "./actions";
import { MAX_CASE_DESCRIPTION_LENGTH } from "../case-intake/validateCaseDescription";
import { frozenComposerBody } from "./projectAramTurn";
import { validateUserMessage } from "./validateUserMessage";

type ChatComposerProps = {
  caseId: string | null;
  frozen: boolean;
};

export function ChatComposer({ caseId, frozen }: ChatComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();
  const errorId = useId();
  const countId = useId();

  if (frozen) {
    return (
      <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-stone-600">
        {frozenComposerBody()}
      </p>
    );
  }

  async function handleSend() {
    if (isSending) {
      return;
    }

    const validation = validateUserMessage(body);

    if (!validation.ok) {
      setValidationMessage(validation.message);
      textareaRef.current?.focus();
      return;
    }

    setValidationMessage(null);
    setIsSending(true);

    const result = await sendMessage(caseId, body);

    setIsSending(false);

    if (!result.ok) {
      setValidationMessage(result.message);
      textareaRef.current?.focus();
      return;
    }

    setBody("");

    if (caseId === null || caseId !== result.caseId) {
      router.push(`/chat/${result.caseId}`);
      return;
    }

    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSend();
  }

  return (
    <form className="flex flex-col gap-2 px-4 py-3" onSubmit={handleSubmit} noValidate>
      <label htmlFor={textareaId} className="sr-only">
        Message
      </label>
      <textarea
        ref={textareaRef}
        id={textareaId}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (validationMessage !== null) {
            const result = validateUserMessage(event.target.value);
            setValidationMessage(result.ok ? null : result.message);
          }
        }}
        aria-invalid={validationMessage !== null}
        aria-describedby={`${countId}${validationMessage ? ` ${errorId}` : ""}`}
        autoComplete="off"
        maxLength={MAX_CASE_DESCRIPTION_LENGTH}
        rows={3}
        placeholder="Describe what happened in your own words."
        className="w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-base leading-7 text-stone-900 placeholder:text-stone-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <p id={countId} className="text-sm text-stone-500">
          {body.length.toLocaleString("en-IN")} /{" "}
          {MAX_CASE_DESCRIPTION_LENGTH.toLocaleString("en-IN")}
        </p>
        <button
          type="submit"
          disabled={isSending}
          className="inline-flex h-10 items-center justify-center rounded-full bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {isSending ? "Sending" : "Send"}
        </button>
      </div>
      {validationMessage ? (
        <p id={errorId} role="alert" className="text-sm text-red-800">
          {validationMessage}
        </p>
      ) : null}
    </form>
  );
}
