"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { deleteCase, updateCase } from "@/features/cases/actions";
import {
  MAX_CASE_DESCRIPTION_LENGTH,
  validateCaseDescription,
} from "@/features/case-intake/validateCaseDescription";

type CaseDetailFormProps = {
  caseId: string;
  description: string;
};

export function CaseDetailForm({ caseId, description }: CaseDetailFormProps) {
  const [caseDescription, setCaseDescription] = useState(description);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const textareaId = useId();
  const countId = useId();
  const errorId = useId();
  const deleteConfirmId = useId();

  const isBusy = isSaving || isDeleting;

  function handleDescriptionChange(value: string) {
    setCaseDescription(value);

    if (validationMessage !== null) {
      const result = validateCaseDescription(value);
      setValidationMessage(result.ok ? null : result.message);
    }
  }

  async function handleSave() {
    if (isBusy) {
      return;
    }

    const result = validateCaseDescription(caseDescription);

    if (!result.ok) {
      setValidationMessage(result.message);
      textareaRef.current?.focus();
      return;
    }

    setValidationMessage(null);
    setIsSaving(true);

    const saveResult = await updateCase(caseId, caseDescription);

    setIsSaving(false);

    if (!saveResult.ok) {
      setValidationMessage(saveResult.message);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSave();
  }

  async function handleDelete() {
    if (isBusy) {
      return;
    }

    setValidationMessage(null);
    setIsDeleting(true);

    const deleteResult = await deleteCase(caseId);

    setIsDeleting(false);

    if (!deleteResult.ok) {
      setValidationMessage(deleteResult.message);
    }
  }

  const describedBy = [countId, validationMessage ? errorId : null]
    .filter((id): id is string => id !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor={textareaId}
            className="text-base font-semibold text-stone-900"
          >
            Your description
          </label>
          <textarea
            ref={textareaRef}
            id={textareaId}
            value={caseDescription}
            onChange={(event) => handleDescriptionChange(event.target.value)}
            aria-invalid={validationMessage !== null}
            aria-describedby={describedBy}
            autoComplete="off"
            maxLength={MAX_CASE_DESCRIPTION_LENGTH}
            className="min-h-64 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-base leading-7 text-stone-900 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 focus:outline-none"
          />
          <p id={countId} className="text-sm text-stone-500">
            {caseDescription.length.toLocaleString("en-IN")} /{" "}
            {MAX_CASE_DESCRIPTION_LENGTH.toLocaleString("en-IN")} characters
          </p>
          {validationMessage ? (
            <p id={errorId} role="alert" className="text-sm text-red-800">
              {validationMessage}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex h-12 items-center justify-center self-start rounded-full bg-teal-800 px-6 text-base font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {isSaving ? "Saving" : "Save changes"}
        </button>
      </form>

      <div className="flex flex-col items-start gap-3">
        {isConfirmingDelete ? (
          <div className="flex flex-col gap-3">
            <p id={deleteConfirmId} className="text-sm leading-7 text-stone-700">
              This permanently removes the saved description. It cannot be
              restored.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isBusy}
                aria-describedby={deleteConfirmId}
                onClick={() => {
                  void handleDelete();
                }}
                className="inline-flex h-12 items-center justify-center rounded-full bg-red-800 px-6 text-base font-medium text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                {isDeleting ? "Deleting" : "Confirm deletion"}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsConfirmingDelete(false)}
                className="text-sm font-medium text-stone-600 hover:text-stone-900 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setValidationMessage(null);
              setIsConfirmingDelete(true);
            }}
            className="text-sm font-medium text-red-800 hover:text-red-900 disabled:cursor-not-allowed"
          >
            Delete this case
          </button>
        )}
      </div>
    </div>
  );
}
