import type { DetailsLink, DetailsWorkspaceModel } from "./detailsWorkspaceModel";
import { rightPanelDensity } from "./panelWidth";

type DetailsPanelProps = {
  model: DetailsWorkspaceModel | null;
  emptyCopy: string;
  width: number;
  expandedSections: ReadonlySet<string>;
  onToggleSection: (id: string) => void;
  onOpenLink: (link: DetailsLink) => void;
};

export function DetailsPanel({
  model,
  emptyCopy,
  width,
  expandedSections,
  onToggleSection,
  onOpenLink,
}: DetailsPanelProps) {
  if (model === null) {
    return <p className="text-sm leading-6 text-stone-600">{emptyCopy}</p>;
  }

  const density = rightPanelDensity(width);
  const evidenceCount = model.evidence.length + model.attachments.length;

  return (
    <div className="flex flex-col gap-5">
      {model.overview.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Overview
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-800">{model.overview[0]}</p>
        </section>
      ) : null}

      {model.keyDetails.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Key details
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {model.keyDetails.map((item) => (
              <li key={item} className="text-sm leading-6 text-stone-700">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DisclosureSection
        id="people"
        title="People"
        count={model.people.length}
        items={model.people}
        expanded={expandedSections.has("people")}
        density={density}
        onToggle={onToggleSection}
      />
      <DisclosureSection
        id="money"
        title="Money"
        count={model.money.length}
        items={model.money}
        expanded={expandedSections.has("money")}
        density={density}
        onToggle={onToggleSection}
      />
      <DisclosureSection
        id="timeline"
        title="Timeline"
        count={model.timeline.length}
        items={model.timeline}
        expanded={expandedSections.has("timeline")}
        density={density}
        onToggle={onToggleSection}
      />
      <DisclosureSection
        id="facts"
        title="Important facts"
        count={model.importantFacts.length}
        items={model.importantFacts}
        expanded={expandedSections.has("facts")}
        density={density}
        onToggle={onToggleSection}
      />
      <DisclosureSection
        id="evidence"
        title="Evidence & attachments"
        count={evidenceCount}
        items={[
          ...model.evidence,
          ...model.attachments.map((attachment) => attachment.name),
        ]}
        expanded={expandedSections.has("evidence")}
        density={density}
        onToggle={onToggleSection}
      />
      {model.links.length > 0 ? (
        <section>
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-3 text-left"
            onClick={() => onToggleSection("links")}
            aria-expanded={expandedSections.has("links")}
          >
            <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
              Links · {model.links.length}
            </span>
            <span className="text-stone-400">{expandedSections.has("links") ? "▾" : "›"}</span>
          </button>
          {density === "roomy" && !expandedSections.has("links") ? (
            <ul className="mt-2 flex flex-col gap-1">
              {model.links.slice(0, 3).map((link) => (
                <li key={link.url}>
                  <button
                    type="button"
                    onClick={() => onOpenLink(link)}
                    className="truncate text-sm text-teal-900 hover:underline"
                  >
                    {link.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {expandedSections.has("links") ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {model.links.map((link) => (
                <li key={link.url}>
                  <button
                    type="button"
                    onClick={() => onOpenLink(link)}
                    className="break-words text-left text-sm leading-6 text-teal-900 hover:underline"
                  >
                    {link.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <DisclosureSection
        id="assumptions"
        title="What I'm going with"
        count={model.assumptions.length}
        items={model.assumptions}
        expanded={expandedSections.has("assumptions")}
        density={density}
        onToggle={onToggleSection}
      />
    </div>
  );
}

function DisclosureSection({
  id,
  title,
  count,
  items,
  expanded,
  density,
  onToggle,
}: {
  id: string;
  title: string;
  count: number;
  items: string[];
  expanded: boolean;
  density: "compact" | "roomy";
  onToggle: (id: string) => void;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <section>
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-3 text-left"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {title} · {count}
        </span>
        <span className="text-stone-400">{expanded ? "▾" : "›"}</span>
      </button>
      {density === "roomy" && !expanded ? (
        <ul className="mt-2 flex flex-col gap-1">
          {items.slice(0, 3).map((item) => (
            <li key={item} className="truncate text-sm text-stone-600">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {expanded ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item} className="break-words text-sm leading-6 text-stone-700">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
