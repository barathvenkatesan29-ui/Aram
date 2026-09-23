"use client";

import { useId, useState } from "react";
import { understandCase } from "@/features/situation-understanding/actions";

type UnderstandCaseFormProps = {
  caseId: string;
};

export function UnderstandCaseForm({ caseId }: UnderstandCaseFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const errorId = useId();

  async function handleUnderstand() {
    if (isUnderstanding) {
      return;
    }

    setMessage(null);
    setIsUnderstanding(true);

    const result = await understandCase(caseId);

    setIsUnderstanding(false);

    if (!result.ok) {
      setMessage(result.message);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        disabled={isUnderstanding}
        onClick={() => {
          void handleUnderstand();
        }}
        className="inline-flex h-12 items-center justify-center rounded-full bg-teal-800 px-6 text-base font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {isUnderstanding ? "Understanding…" : "Understand this situation"}
      </button>
      {message ? (
        <p id={errorId} role="alert" className="text-sm text-red-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
