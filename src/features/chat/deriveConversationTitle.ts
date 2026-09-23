const MAX_TITLE_LENGTH = 60;
const MIN_TITLE_SOURCE_PARAGRAPH_LENGTH = 12;
const URL_PATTERN = /https?:\/\//i;
const LEGAL_TITLE_PATTERNS: readonly RegExp[] = [
  /\bliable\b/i,
  /\bstatute\b/i,
  /\bsection\s*\d+/i,
  /\blegal right/i,
  /\byour rights\b/i,
];

export function shouldWriteConversationTitle(currentTitle: string | null): boolean {
  return currentTitle === null || currentTitle.trim().length === 0;
}

export function deriveConversationTitle(description: string): string | null {
  const compactNarrative = titleSourceFromFrozenDescription(description);

  if (compactNarrative.length === 0) {
    return null;
  }

  const title =
    compactNarrative.length <= MAX_TITLE_LENGTH
      ? compactNarrative
      : truncateTitle(compactNarrative);

  if (URL_PATTERN.test(title)) {
    return null;
  }

  if (LEGAL_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return null;
  }

  return title;
}

function titleSourceFromFrozenDescription(description: string): string {
  const paragraphs = description
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);

  const substantiveParagraphs = paragraphs.filter(
    (paragraph) => paragraph.length >= MIN_TITLE_SOURCE_PARAGRAPH_LENGTH,
  );
  const sourceParagraphs =
    substantiveParagraphs.length > 0 ? substantiveParagraphs : paragraphs;

  return sourceParagraphs.join(" ").trim();
}

function truncateTitle(compactNarrative: string): string {
  const truncatedTitle = compactNarrative.slice(0, MAX_TITLE_LENGTH).trimEnd();
  const lastSpace = truncatedTitle.lastIndexOf(" ");

  if (lastSpace >= 24) {
    return truncatedTitle.slice(0, lastSpace);
  }

  return truncatedTitle;
}
