import type { BrowserTab } from "./browserTabs";

type BrowserWorkspaceProps = {
  tabs: BrowserTab[];
  activeId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
};

export function BrowserWorkspace({
  tabs,
  activeId,
  onSelect,
  onClose,
}: BrowserWorkspaceProps) {
  const active = tabs.find((tab) => tab.id === activeId) ?? null;

  if (tabs.length === 0) {
    return (
      <p className="text-sm leading-6 text-stone-600">
        Open a link from Details to inspect it here. The conversation stays where
        it is.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-1 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const selected = tab.id === active?.id;

          return (
            <div
              key={tab.id}
              className={`flex max-w-[10rem] shrink-0 items-center rounded-full border px-2 ${
                selected
                  ? "border-teal-800 bg-teal-50 text-teal-950"
                  : "border-stone-200 bg-white text-stone-700"
              }`}
            >
              <button
                type="button"
                className="truncate py-1 text-xs font-medium"
                onClick={() => onSelect(tab.id)}
              >
                {tab.title}
              </button>
              <button
                type="button"
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                aria-label={`Close ${tab.title}`}
                onClick={() => onClose(tab.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-stone-500">{active.title}</p>
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-teal-900 hover:underline"
            >
              Open externally ↗
            </a>
          </div>
          <iframe
            title={active.title}
            src={active.url}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            className="min-h-0 flex-1 rounded-lg border border-stone-200 bg-white"
            referrerPolicy="no-referrer"
          />
          <p className="mt-2 text-xs leading-5 text-stone-500">
            If the page does not appear here, open it externally. An Aram reader
            for blocked sources is not available yet.
          </p>
        </div>
      ) : null}
    </div>
  );
}
