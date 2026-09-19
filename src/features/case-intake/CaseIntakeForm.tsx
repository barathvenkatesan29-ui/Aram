"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";
import { createCase } from "@/features/cases/actions";
import {
  MAX_CASE_DESCRIPTION_LENGTH,
  validateCaseDescription,
} from "./validateCaseDescription";

const usefulInformation = [
  "What happened, in order if you can",
  "Roughly when it happened",
  "Who was involved — roles are enough; full legal names are optional",
  "Where it happened, such as a city or state, if that matters",
  "What you have already tried",
  "What you want to happen next",
];

export function CaseIntakeForm() {
  const [caseDescription, setCaseDescription] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const textareaId = useId();
  const guidanceId = useId();
  const privacyId = useId();
  const countId = useId();
  const errorId = useId();

  function handleDescriptionChange(value: string) {
    setCaseDescription(value);

    if (validationMessage !== null) {
      const result = validateCaseDescription(value);
      setValidationMessage(result.ok ? null : result.message);
    }
  }

  async function handleSave() {
    if (isSaving) {
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

    const saveResult = await createCase(caseDescription);

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

  const describedBy = [
    privacyId,
    guidanceId,
    countId,
    validationMessage ? errorId : null,
  ]
    .filter((id): id is string => id !== null)
    .join(" ");

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
          Starting a case · Step 1
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Describe what happened
        </h1>
        <p className="text-lg leading-8 text-stone-600">
          You do not need legal wording. Write what happened in ordinary
          language. This is the first step of a case. Later steps are not open
          yet.
        </p>
      </header>

      <LegalInformationNotice />

      <aside
        id={privacyId}
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-stone-700"
        aria-label="Privacy warning"
      >
        <p>
          <strong className="font-semibold">
            Saving stores this description with your account. Only you can see
            it.
          </strong>{" "}
          Do not enter Aadhaar, PAN, passport numbers, bank account or IFSC
          details, OTPs, passwords, or full private documents. If you leave or
          refresh before saving, the text in this box will be gone. Your
          browser, keyboard, operating system, or installed writing tools can
          still process what you type; that happens outside Aram&apos;s control.
        </p>
      </aside>

      <section id={guidanceId} className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">What helps</h2>
        <p className="leading-7 text-stone-600">
          You do not have to cover every point. These details are useful when
          you know them:
        </p>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-stone-600">
          {usefulInformation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

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
            placeholder="Start with what happened, in your own words. For example: who was involved, roughly when it took place, and what you want to happen next."
            className="min-h-64 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-base leading-7 text-stone-900 placeholder:text-stone-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 focus:outline-none"
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

        <div className="flex flex-col items-start gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-12 items-center justify-center rounded-full bg-teal-800 px-6 text-base font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isSaving ? "Saving" : "Save this description"}
          </button>
          <p className="text-sm text-stone-500">
            Saving stores this description with your account. Later steps are
            not open yet.
          </p>
        </div>
      </form>
    </div>
  );
}
