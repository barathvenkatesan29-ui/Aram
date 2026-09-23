"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { answerOptionalClarification, skipOptionalClarification } from "./actions";
import { MAX_ANSWER_LENGTH } from "../situation-understanding/validateQuestionAnswer";
import type { ClarificationCarouselView } from "./optionalClarification";

type ClarificationCarouselProps = {
  caseId: string;
  carousel: ClarificationCarouselView;
  embedded?: boolean;
};

export function ClarificationCarousel({
  caseId,
  carousel,
  embedded = false,
}: ClarificationCarouselProps) {
  const router = useRouter();
  const [manualAnswer, setManualAnswer] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const manualId = useId();
  const current = carousel.current;

  async function submitAnswer(body: string) {
    if (!current || isSending) {
      return;
    }

    setIsSending(true);
    setValidationMessage(null);
    const result = await answerOptionalClarification(caseId, current.questionId, body);
    setIsSending(false);

    if (!result.ok) {
      setValidationMessage(result.message);
      return;
    }

    setManualAnswer("");
    router.refresh();
  }

  async function skip() {
    if (!current || isSending) {
      return;
    }

    setIsSending(true);
    setValidationMessage(null);
    const result = await skipOptionalClarification(caseId, current.questionId);
    setIsSending(false);

    if (!result.ok) {
      setValidationMessage(result.message);
      return;
    }

    setManualAnswer("");
    router.refresh();
  }

  return (
    <div className={embedded ? "" : "mt-5 border-t border-stone-200 pt-4"}>
      {carousel.previous.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Earlier details
          </p>
          {carousel.previous.map((card) => {
            const open = reviewingId === card.questionId;

            return (
              <div key={card.questionId}>
                <button
                  type="button"
                  className="text-left text-sm font-medium text-stone-800 hover:underline"
                  onClick={() =>
                    setReviewingId(open ? null : card.questionId)
                  }
                >
                  {card.question}
                </button>
                {open ? (
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {card.status === "skipped"
                      ? "Skipped"
                      : card.answer ?? "Answered"}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {current ? (
        <section className="rounded-2xl bg-stone-50 px-4 py-4">
          <ProgressDots
            previousCount={carousel.previous.length}
            hasCurrent
            remainingAfterCurrent={carousel.remainingAfterCurrent}
          />
          <h3 className="mt-3 text-base font-semibold leading-7 text-stone-900">
            {current.question}
          </h3>
          <p className="mt-1 text-sm leading-6 text-stone-600">{current.whyItMatters}</p>
          {current.options.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isSending}
                  onClick={() => void submitAnswer(option)}
                  className="min-h-12 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-left text-sm font-medium leading-6 text-stone-900 hover:border-teal-800 hover:text-teal-950 disabled:cursor-not-allowed"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
          <label htmlFor={manualId} className="mt-4 block text-sm font-medium text-stone-800">
            Something else…
          </label>
          <textarea
            id={manualId}
            value={manualAnswer}
            onChange={(event) => setManualAnswer(event.target.value)}
            maxLength={MAX_ANSWER_LENGTH}
            rows={3}
            placeholder="Add this in your own words."
            className="mt-2 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-base leading-7 text-stone-900 placeholder:text-stone-400 focus:border-teal-800 focus:ring-2 focus:ring-teal-800/20 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSending}
              onClick={() => void submitAnswer(manualAnswer)}
              className="inline-flex h-10 items-center justify-center rounded-full bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {isSending ? "Saving" : "Add detail"}
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() => void skip()}
              className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Skip
            </button>
          </div>
          {validationMessage ? (
            <p role="alert" className="mt-2 text-sm text-red-800">
              {validationMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ProgressDots({
  previousCount,
  hasCurrent,
  remainingAfterCurrent,
}: {
  previousCount: number;
  hasCurrent: boolean;
  remainingAfterCurrent: number;
}) {
  if (!hasCurrent && previousCount === 0) {
    return null;
  }

  const remainingDots = remainingAfterCurrent > 0;
  const dots = [
    ...Array.from({ length: previousCount }, () => "done" as const),
    ...(hasCurrent ? (["current"] as const) : []),
    ...(remainingDots ? (["later"] as const) : []),
  ];

  if (dots.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {dots.map((dot, index) => (
        <span
          key={`${dot}:${index}`}
          className={`h-1.5 rounded-full ${
            dot === "current"
              ? "w-4 bg-teal-800"
              : dot === "done"
                ? "w-1.5 bg-stone-400"
                : "w-1.5 bg-stone-300"
          }`}
        />
      ))}
    </div>
  );
}
