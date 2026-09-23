"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type {
  ConversationAction,
  EvidenceSummary,
  HelpNextCapability,
  NextStepAction,
  OrientationModel,
  RecommendedNextAction,
} from "./orientationModel";

type OrientationCardProps = {
  model: OrientationModel;
  onStepAction?: (action: ConversationAction) => void;
  precisionSlot?: ReactNode;
  notice?: ReactNode;
};

export function OrientationCard({
  model,
  onStepAction,
  precisionSlot,
  notice,
}: OrientationCardProps) {
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);

  function handleStepAction(action: NextStepAction): void {
    if (action.kind === "show-draft") {
      setOpenDraftId((current) =>
        current === action.draftId ? null : action.draftId,
      );
      return;
    }

    if (action.kind === "view-evidence") {
      onStepAction?.({ id: "view-evidence", label: action.label });
      return;
    }

    onStepAction?.({
      id: "open-verified-source",
      label: action.label,
      url: action.url,
      title: action.title,
    });
  }

  const standingVisible =
    model.standing.inYourFavour.length > 0 ||
    model.standing.currentObstacle !== null ||
    model.standing.currentAssumption !== null;
  const recommended = model.recommendedNextAction;
  const recommendedAction = recommended?.action ?? null;

  return (
    <div className="flex flex-col gap-8">
      {model.whatsHappening.length > 0 ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            What&apos;s happening
          </h2>
          <p className="mt-3 text-base leading-7 text-stone-700">
            {model.whatsHappening}
          </p>
        </section>
      ) : null}

      {standingVisible ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            Where you currently stand
          </h2>
          {model.standing.inYourFavour.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-base font-semibold text-stone-800">
                In your favour
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {model.standing.inYourFavour.map((item) => (
                  <li key={item} className="text-base leading-7 text-stone-700">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {model.standing.currentObstacle !== null ? (
            <div className="mt-4">
              <h3 className="text-base font-semibold text-stone-800">
                Current obstacle
              </h3>
              <p className="mt-2 text-base leading-7 text-stone-700">
                {model.standing.currentObstacle}
              </p>
            </div>
          ) : null}
          {model.standing.currentAssumption !== null ? (
            <div className="mt-4">
              <h3 className="text-base font-semibold text-stone-800">
                Aram&apos;s current assumption
              </h3>
              <p className="mt-2 text-base leading-7 text-stone-700">
                {model.standing.currentAssumption}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {model.nextSteps.length > 0 ? (
        <section
          id="orientation-next-steps"
          className="rounded-2xl bg-teal-50 px-5 py-5"
        >
          <h2 className="text-xl font-semibold tracking-tight text-teal-950">
            Sensible next steps
          </h2>
          <ol className="mt-4 flex flex-col gap-5">
            {model.nextSteps.map((step, index) => {
              const stepAction = contextualStepAction(step, recommended);
              const draftId =
                stepAction?.kind === "show-draft" ? stepAction.draftId : null;
              const draft = draftId !== null ? model.drafts[draftId] : undefined;
              const draftOpen = draftId !== null && openDraftId === draftId;

              return (
                <li key={step.id} className="flex gap-3 text-teal-950">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-800 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="text-base font-semibold leading-7">
                      {step.text}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-teal-900/80">
                      {step.why}
                    </p>
                    {stepAction ? (
                      <button
                        type="button"
                        onClick={() => handleStepAction(stepAction)}
                        className="mt-2 self-start rounded-full border border-teal-800 bg-white px-3 py-1 text-xs font-medium text-teal-950 hover:bg-teal-800 hover:text-white"
                      >
                        {stepAction.label} →
                      </button>
                    ) : null}
                    {draftOpen && draft ? (
                      <div className="mt-2 rounded-xl border border-teal-200 bg-white px-3 py-3">
                        <p className="text-xs leading-5 text-stone-500">
                          Copy and send this yourself. Aram is not sending it.
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
                          {draft}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {model.whatYouShouldntDo.length > 0 ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            What you shouldn&apos;t do
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {model.whatYouShouldntDo.map((item) => (
              <li key={item} className="text-base leading-7 text-stone-700">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {precisionSlot ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            A few details could make this more precise
          </h2>
          <div className="mt-3">{precisionSlot}</div>
        </section>
      ) : null}

      {model.evidence.count > 0 ? (
        <EvidenceSummary
          evidence={model.evidence}
          onViewAll={() =>
            handleStepAction({ kind: "view-evidence", label: "View all in Details" })
          }
        />
      ) : null}

      {model.legalPosition.ready ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            Your legal position
          </h2>
          <p className="mt-3 text-base leading-7 text-stone-700">
            Aram will add a grounded legal position here once sources can be
            checked. Nothing here is a legal conclusion yet.
          </p>
        </section>
      ) : null}

      {model.helpNext.length > 0 ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            Aram can help you next
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {model.helpNext.map((capability) => (
              <HelpNextButton
                key={capability.id}
                capability={capability}
                onAction={handleStepAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      {recommended !== null ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-stone-900">
            Recommended next action
          </h2>
          <p className="mt-3 text-base leading-7 text-stone-700">
            {recommended.summary}
          </p>
          {recommendedAction ? (
            <button
              type="button"
              onClick={() => handleStepAction(recommendedAction)}
              className="mt-3 inline-flex items-center rounded-full bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
            >
              {recommendedAction.label} →
            </button>
          ) : null}
          {recommendedAction?.kind === "show-draft" &&
          openDraftId === recommendedAction.draftId ? (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
              <p className="text-xs leading-5 text-stone-500">
                Copy and send this yourself. Aram is not sending it.
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
                {model.drafts[recommendedAction.draftId]}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {notice}
    </div>
  );
}

function contextualStepAction(
  step: OrientationModel["nextSteps"][number],
  recommended: RecommendedNextAction | null,
): NextStepAction | null {
  if (step.action === null) {
    return null;
  }

  if (recommended !== null && recommended.stepId === step.id) {
    return null;
  }

  return step.action;
}

function evidencePreviewLine(evidence: EvidenceSummary): string | null {
  if (evidence.count === 0 || evidence.preview.length === 0) {
    return null;
  }

  const remainder = evidence.count - evidence.preview.length;
  const joined = evidence.preview.join(", ");
  return remainder > 0 ? `${joined} +${remainder}` : joined;
}

function EvidenceSummary({
  evidence,
  onViewAll,
}: {
  evidence: EvidenceSummary;
  onViewAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const previewLine = evidencePreviewLine(evidence);

  return (
    <section>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full min-w-0 items-center gap-2 text-left text-sm text-stone-600 hover:text-stone-800"
      >
        <span className="min-w-0 truncate">
          Evidence identified · {evidence.count}
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-stone-400 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {previewLine !== null && !expanded ? (
        <p className="mt-1 truncate text-sm leading-6 text-stone-400">
          {previewLine}
        </p>
      ) : null}
      {expanded ? (
        <div className="mt-2">
          <ul className="flex flex-col gap-1">
            {evidence.preview.map((item) => (
              <li key={item} className="break-words text-sm leading-6 text-stone-500">
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onViewAll}
            className="mt-2 text-sm font-medium text-stone-600 hover:text-teal-900 hover:underline"
          >
            View all in Details
          </button>
        </div>
      ) : null}
    </section>
  );
}

function HelpNextButton({
  capability,
  onAction,
}: {
  capability: HelpNextCapability;
  onAction: (action: NextStepAction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAction(capability.action)}
      className="inline-flex h-10 items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 hover:border-teal-800 hover:text-teal-900"
    >
      {capability.label}
    </button>
  );
}
