export const MIN_CASE_DESCRIPTION_LENGTH = 50;
export const MAX_CASE_DESCRIPTION_LENGTH = 8000;

export type CaseDescriptionValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateCaseDescription(
  caseDescription: string,
): CaseDescriptionValidationResult {
  const trimmedDescription = caseDescription.trim();

  if (trimmedDescription.length === 0) {
    return {
      ok: false,
      message: "Please describe what happened before continuing.",
    };
  }

  if (caseDescription.length > MAX_CASE_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message:
        "Please shorten the description. This version accepts up to 8,000 characters.",
    };
  }

  if (trimmedDescription.length < MIN_CASE_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message:
        "Please add a little more detail so this can be treated as a case description.",
    };
  }

  return { ok: true };
}
