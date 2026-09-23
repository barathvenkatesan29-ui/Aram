import type { StoredAnalysisView } from "@/types/situationUnderstanding";
import type { FriendlySituationPanel } from "./situationPanelModel";

type SituationPanelProps = {
  view: StoredAnalysisView | null;
  panel: FriendlySituationPanel | null;
};

export function SituationPanel({ view, panel }: SituationPanelProps) {
  return (
    <aside
      aria-label="Situation"
      className="flex w-full shrink-0 flex-col border-t border-stone-200 bg-white lg:w-80 lg:border-t-0 lg:border-l"
    >
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">Situation</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <SituationPanelBody view={view} panel={panel} />
      </div>
    </aside>
  );
}

function SituationPanelBody({ view, panel }: SituationPanelProps) {
  if (!view) {
    return (
      <p className="leading-7 text-stone-600">
        Aram will organise what you share here after there is enough to work
        with.
      </p>
    );
  }

  if (view.kind === "understood" && panel) {
    return (
      <div className="flex flex-col gap-5">
        <PanelSection title="Summary" items={panel.summary} />
        <PanelSection title="What happened" items={panel.whatHappened} />
        <PanelSection title="People involved" items={panel.peopleInvolved} />
        <PanelSection title="Money involved" items={panel.moneyInvolved} />
        <PanelSection title="Timeline" items={panel.timeline} />
        <PanelSection title="Evidence" items={panel.evidence} />
        <PanelSection title="What you want" items={panel.whatYouWant} />
        <PanelSection title="Still unclear" items={panel.stillUnclear} />
      </div>
    );
  }

  if (view.kind === "could-not-understand") {
    return (
      <p className="leading-7 text-stone-700">
        Could not understand this situation yet. You can add a little more
        detail.
      </p>
    );
  }

  if (view.kind === "unrenderable") {
    return (
      <p className="leading-7 text-stone-700">
        This understanding could not be shown.
      </p>
    );
  }

  if (view.kind === "out-of-date") {
    return (
      <p className="leading-7 text-stone-700">
        This understanding is out of date because the saved description has
        changed.
      </p>
    );
  }

  return (
    <p className="leading-7 text-stone-600">
      Aram will organise what you share here after there is enough to work with.
    </p>
  );
}

function PanelSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${title}:${item}`} className="text-sm leading-6 text-stone-700">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
