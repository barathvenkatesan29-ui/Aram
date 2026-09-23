import {
  MAX_CASE_DESCRIPTION_LENGTH,
  MIN_CASE_DESCRIPTION_LENGTH,
} from "../case-intake/validateCaseDescription.ts";

export function validateUserMessage(body: string): { ok: true } | { ok: false; message: string } {
  const trimmedBody = body.trim();

  if (trimmedBody.length < MIN_CASE_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: "Please type a message before sending.",
    };
  }

  if (body.length > MAX_CASE_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message:
        "Please shorten the message. This version accepts up to 8,000 characters.",
    };
  }

  return { ok: true };
}
