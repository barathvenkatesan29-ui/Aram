import type { FollowUpQuestion } from "../../types/situationUnderstanding.ts";

export const SYNTHETIC_ASKABLE_QUESTION_ID =
  "77777777-7777-4777-8777-777777777777";
export const SYNTHETIC_SECOND_ASKABLE_QUESTION_ID =
  "99999999-9999-4999-8999-999999999999";
export const SYNTHETIC_SKIPPED_QUESTION_ID =
  "88888888-8888-4888-8888-888888888888";

export function stubLikeInventoryQuestion(): FollowUpQuestion {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    position: 1,
    question: "When did this happen?",
    why_it_matters: "A rough date can show what is still missing.",
  };
}

export function validAskableClarification(
  overrides?: Partial<FollowUpQuestion>,
): FollowUpQuestion {
  return {
    id: SYNTHETIC_ASKABLE_QUESTION_ID,
    position: 1,
    question: "Was the deposit meant to be returned when you moved out?",
    why_it_matters:
      "Whether return was expected can change what this situation appears to be.",
    ask_now: true,
    materiality: "orientation_fork",
    already_supplied: false,
    action_mode_only: false,
    suggested_options: [
      "Yes, it was to be returned in full",
      "They said some amount could be deducted",
      "I'm not sure",
    ],
    ...overrides,
  };
}

export function extraInventoryQuestion(): FollowUpQuestion {
  return {
    id: SYNTHETIC_SKIPPED_QUESTION_ID,
    position: 2,
    question: "What is the exact building address?",
    why_it_matters: "An address can be useful later.",
    ask_now: false,
    materiality: "none",
    already_supplied: false,
    action_mode_only: false,
  };
}
