const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCaseId(value: string): string | null {
  const trimmedValue = value.trim().toLowerCase();

  if (!UUID_PATTERN.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

export function getCaseIdFromPathname(pathname: string): string | null {
  const match = /^\/cases\/([^/]+)$/.exec(pathname);

  if (!match) {
    return null;
  }

  return parseCaseId(match[1]);
}

export function getChatIdFromPathname(pathname: string): string | null {
  const match = /^\/chat\/([^/]+)$/.exec(pathname);

  if (!match) {
    return null;
  }

  return parseCaseId(match[1]);
}
