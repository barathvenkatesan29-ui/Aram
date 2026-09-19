const DEFAULT_NEXT_PATH = "/start";
const CASE_NEXT_PATH_PATTERN =
  /^\/cases\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if (decodedValue === DEFAULT_NEXT_PATH) {
    return DEFAULT_NEXT_PATH;
  }

  if (CASE_NEXT_PATH_PATTERN.test(decodedValue)) {
    return `/cases/${decodedValue.slice("/cases/".length).toLowerCase()}`;
  }

  return DEFAULT_NEXT_PATH;
}
