const DEFAULT_NEXT_PATH = "/chat";
const CASE_NEXT_PATH_PATTERN =
  /^\/cases\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAT_NEXT_PATH_PATTERN =
  /^\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getSafeNextPath(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== "string") {
    return DEFAULT_NEXT_PATH;
  }

  let decodedValue = rawValue.trim();

  try {
    decodedValue = decodeURIComponent(decodedValue);
  } catch {
    return DEFAULT_NEXT_PATH;
  }

  if (
    decodedValue.includes("?") ||
    decodedValue.includes("#") ||
    decodedValue.includes("//") ||
    decodedValue.includes("\\")
  ) {
    return DEFAULT_NEXT_PATH;
  }

  if (decodedValue === DEFAULT_NEXT_PATH || decodedValue === "/start") {
    return DEFAULT_NEXT_PATH;
  }

  if (decodedValue === "/cases") {
    return "/chat";
  }

  if (decodedValue === "/chat/archived") {
    return "/chat/archived";
  }

  if (CASE_NEXT_PATH_PATTERN.test(decodedValue)) {
    return `/chat/${decodedValue.slice("/cases/".length).toLowerCase()}`;
  }

  if (CHAT_NEXT_PATH_PATTERN.test(decodedValue)) {
    return `/chat/${decodedValue.slice("/chat/".length).toLowerCase()}`;
  }

  return DEFAULT_NEXT_PATH;
}
