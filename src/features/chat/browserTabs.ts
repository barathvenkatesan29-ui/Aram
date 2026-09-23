export type BrowserTab = {
  id: string;
  url: string;
  title: string;
};

export function openOrReuseBrowserTab(
  tabs: BrowserTab[],
  input: { url: string; title: string },
): { tabs: BrowserTab[]; activeId: string } {
  const existing = tabs.find((tab) => tab.url === input.url);

  if (existing) {
    return { tabs, activeId: existing.id };
  }

  const tab: BrowserTab = {
    id: `browser:${input.url}`,
    url: input.url,
    title: input.title,
  };

  return {
    tabs: [...tabs, tab],
    activeId: tab.id,
  };
}

export function closeBrowserTab(
  tabs: BrowserTab[],
  tabId: string,
  activeId: string | null,
): { tabs: BrowserTab[]; activeId: string | null } {
  const remaining = tabs.filter((tab) => tab.id !== tabId);

  if (remaining.length === 0) {
    return { tabs: [], activeId: null };
  }

  if (activeId !== tabId) {
    const stillActive = remaining.some((tab) => tab.id === activeId);
    return { tabs: remaining, activeId: stillActive ? activeId : remaining[0]?.id ?? null };
  }

  const closedIndex = tabs.findIndex((tab) => tab.id === tabId);
  const next = remaining[Math.min(closedIndex, remaining.length - 1)];

  return { tabs: remaining, activeId: next?.id ?? null };
}
