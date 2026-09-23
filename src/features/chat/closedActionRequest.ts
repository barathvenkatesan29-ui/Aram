const ACTION_REQUEST_PATTERN =
  /\b(prepare a complaint|send a notice|file a case|prepare a document|escalate this)\b/i;

export function looksLikeClosedActionRequest(body: string): boolean {
  return ACTION_REQUEST_PATTERN.test(body.trim());
}

export const CLOSED_ACTION_MESSAGE =
  "Preparing a complaint, notice, or filing is not open yet.";

export const FROZEN_FREE_TEXT_MESSAGE =
  "This conversation is already organised from what you have shared.";
