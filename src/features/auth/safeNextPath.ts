const ALLOWED_NEXT_PATH = "/start";

export function getSafeNextPath(
  value: string | string[] | undefined,
): typeof ALLOWED_NEXT_PATH {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== "string") {
    return ALLOWED_NEXT_PATH;
  }

  let decodedValue = rawValue.trim();

  try {
    decodedValue = decodeURIComponent(decodedValue);
  } catch {
    return ALLOWED_NEXT_PATH;
  }

  if (decodedValue !== ALLOWED_NEXT_PATH) {
    return ALLOWED_NEXT_PATH;
  }

  return ALLOWED_NEXT_PATH;
}
