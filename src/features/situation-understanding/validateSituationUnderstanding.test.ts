import assert from "node:assert/strict";
import { test } from "node:test";
import { toCanonicalAnswers } from "./canonicalAnswers.ts";
import { hashCanonicalAnswers } from "./hashCaseInput.ts";
import {
  validateQuestionAnswer,
  validateStoredQuestions,
} from "./validateQuestionAnswer.ts";
import { validateSituationUnderstanding } from "./validateSituationUnderstanding.ts";
import type {
  CanonicalAnswer,
  SituationUnderstandingValidationContext,
  StoredQuestion,
} from "../../types/situationUnderstanding.ts";

const DESCRIPTION =
  "The landlord kept the rental deposit after I moved out of the flat in Pune in March.";

const QUESTION_ID_EARLIER_UUID = "00000000-0000-4000-8000-000000000001";
const QUESTION_ID_LATER_UUID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const INITIAL_CONTEXT: SituationUnderstandingValidationContext = {
  round: "initial",
  description: DESCRIPTION,
  answers: [],
};

function validUnderstanding(overrides?: Record<string, unknown>) {
  return {
    userFacts: [
      {
        text: "The landlord kept the rental deposit.",
        quote: "The landlord kept the rental deposit",
        source_kind: "description",
        source_question_id: null,
      },
    ],
    parties: [{ label: "landlord", role: "other party" }],
    inferences: [],
    assumptions: [],
    situationThemes: [{ text: "rental deposit" }],
    missingInformation: [],
    uncertainties: [],
    questions: [],
    ...overrides,
  };
}

test("valid description-sourced fact passes", () => {
  const result = validateSituationUnderstanding(
    validUnderstanding(),
    INITIAL_CONTEXT,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.understanding.userFacts[0]?.source_kind, "description");
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.understanding, "version"),
      false,
    );
  }
});

test("answer-sourced fact without source_question_id fails", () => {
  const result = validateSituationUnderstanding(
    validUnderstanding({
      userFacts: [
        {
          text: "The user paid by UPI.",
          quote: "I paid by UPI on 5 August",
          source_kind: "answer",
        },
      ],
    }),
    {
      round: "follow_up",
      description: DESCRIPTION,
      answers: [
        {
          id: QUESTION_ID_EARLIER_UUID,
          position: 1,
          status: "answered",
          answer: "I paid by UPI on 5 August",
        },
      ],
    },
  );

  assert.equal(result.ok, false);
});

test("answer quote is checked against the answer, not the description", () => {
  const answers: CanonicalAnswer[] = [
    {
      id: QUESTION_ID_EARLIER_UUID,
      position: 1,
      status: "answered",
      answer: "I paid by UPI on 5 August",
    },
  ];
  const context: SituationUnderstandingValidationContext = {
    round: "follow_up",
    description: DESCRIPTION,
    answers,
  };

  const matchingAnswer = validateSituationUnderstanding(
    validUnderstanding({
      userFacts: [
        {
          text: "The user paid by UPI.",
          quote: "I paid by UPI on 5 August",
          source_kind: "answer",
          source_question_id: QUESTION_ID_EARLIER_UUID,
        },
      ],
      questions: [],
    }),
    context,
  );

  assert.equal(matchingAnswer.ok, true);
  if (matchingAnswer.ok) {
    assert.equal(matchingAnswer.understanding.userFacts.length, 1);
    assert.equal(
      matchingAnswer.understanding.userFacts[0]?.source_question_id,
      QUESTION_ID_EARLIER_UUID,
    );
  }

  const quoteOnlyInDescription = validateSituationUnderstanding(
    validUnderstanding({
      userFacts: [
        {
          text: "The landlord kept the rental deposit.",
          quote: "The landlord kept the rental deposit",
          source_kind: "answer",
          source_question_id: QUESTION_ID_EARLIER_UUID,
        },
      ],
      questions: [],
    }),
    context,
  );

  assert.equal(quoteOnlyInDescription.ok, true);
  if (quoteOnlyInDescription.ok) {
    assert.equal(quoteOnlyInDescription.understanding.userFacts.length, 0);
  }
});

test("initial run rejects source_kind answer", () => {
  const result = validateSituationUnderstanding(
    validUnderstanding({
      userFacts: [
        {
          text: "The user paid by UPI.",
          quote: "I paid by UPI on 5 August",
          source_kind: "answer",
          source_question_id: QUESTION_ID_EARLIER_UUID,
        },
      ],
    }),
    INITIAL_CONTEXT,
  );

  assert.equal(result.ok, false);
});

test("theme breach of contract is rejected and refund dispute is accepted", () => {
  const rejected = validateSituationUnderstanding(
    validUnderstanding({
      situationThemes: [{ text: "breach of contract" }],
    }),
    INITIAL_CONTEXT,
  );
  const accepted = validateSituationUnderstanding(
    validUnderstanding({
      situationThemes: [{ text: "refund dispute" }],
    }),
    INITIAL_CONTEXT,
  );

  assert.equal(rejected.ok, false);
  assert.equal(accepted.ok, true);
});

test("more than 5 questions is rejected", () => {
  const questions = Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    position: index + 1,
    question: "When did this happen?",
    why_it_matters: "A date can show what is still missing.",
  }));

  const result = validateSituationUnderstanding(
    validUnderstanding({ questions }),
    INITIAL_CONTEXT,
  );

  assert.equal(result.ok, false);
});

test("duplicate positions are rejected", () => {
  const result = validateSituationUnderstanding(
    validUnderstanding({
      questions: [
        {
          id: QUESTION_ID_EARLIER_UUID,
          position: 1,
          question: "When did this happen?",
          why_it_matters: "A date can show what is still missing.",
        },
        {
          id: QUESTION_ID_LATER_UUID,
          position: 1,
          question: "Where did this happen?",
          why_it_matters: "A place can show what is still missing.",
        },
      ],
    }),
    INITIAL_CONTEXT,
  );

  assert.equal(result.ok, false);
});

test("follow-up with questions is rejected", () => {
  const result = validateSituationUnderstanding(
    validUnderstanding({
      questions: [
        {
          id: QUESTION_ID_EARLIER_UUID,
          position: 1,
          question: "When did this happen?",
          why_it_matters: "A date can show what is still missing.",
        },
      ],
    }),
    {
      round: "follow_up",
      description: DESCRIPTION,
      answers: [
        {
          id: QUESTION_ID_EARLIER_UUID,
          position: 1,
          status: "skipped",
          answer: "",
        },
      ],
    },
  );

  assert.equal(result.ok, false);
});

test("answered empty or whitespace fails", () => {
  const emptyResult = validateQuestionAnswer({
    status: "answered",
    answer: "",
  });
  const whitespaceResult = validateQuestionAnswer({
    status: "answered",
    answer: "   ",
  });

  assert.equal(emptyResult.ok, false);
  assert.equal(whitespaceResult.ok, false);
});

test("answered 2001 characters fails", () => {
  const result = validateQuestionAnswer({
    status: "answered",
    answer: "a".repeat(2001),
  });

  assert.equal(result.ok, false);
});

test("skipped with leftover text fails", () => {
  const result = validateQuestionAnswer({
    status: "skipped",
    answer: "I paid by UPI on 5 August",
  });

  assert.equal(result.ok, false);
});

test("pending and skipped require a null answer", () => {
  assert.equal(
    validateQuestionAnswer({ status: "pending", answer: null }).ok,
    true,
  );
  assert.equal(
    validateQuestionAnswer({ status: "skipped", answer: null }).ok,
    true,
  );
});

test("canonical answers are ordered by position, not UUID", () => {
  const questions: StoredQuestion[] = [
    {
      id: QUESTION_ID_EARLIER_UUID,
      position: 2,
      question: "Where did this happen?",
      why_it_matters: "A place can show what is still missing.",
      status: "answered",
      answer: "Pune",
    },
    {
      id: QUESTION_ID_LATER_UUID,
      position: 1,
      question: "When did this happen?",
      why_it_matters: "A date can show what is still missing.",
      status: "answered",
      answer: "March",
    },
  ];

  const canonical = toCanonicalAnswers(questions);

  assert.ok(canonical);
  assert.equal(canonical[0]?.id, QUESTION_ID_LATER_UUID);
  assert.equal(canonical[0]?.position, 1);
  assert.equal(canonical[1]?.id, QUESTION_ID_EARLIER_UUID);
  assert.equal(canonical[1]?.position, 2);

  const sameHashDifferentArrayOrder = hashCanonicalAnswers(canonical);
  const reversedInputHash = hashCanonicalAnswers([...canonical].reverse());

  assert.equal(sameHashDifferentArrayOrder, reversedInputHash);
});

test("stored questions reject a gap in position", () => {
  const result = validateStoredQuestions([
    {
      id: QUESTION_ID_EARLIER_UUID,
      position: 1,
      question: "When did this happen?",
      why_it_matters: "A date can show what is still missing.",
      status: "pending",
      answer: null,
    },
    {
      id: QUESTION_ID_LATER_UUID,
      position: 3,
      question: "Where did this happen?",
      why_it_matters: "A place can show what is still missing.",
      status: "pending",
      answer: null,
    },
  ]);

  assert.equal(result.ok, false);
});

test("valid orientation_fork metadata is kept and invalid metadata does not fail the understanding", () => {
  const accepted = validateSituationUnderstanding(
    validUnderstanding({
      questions: [
        {
          id: QUESTION_ID_EARLIER_UUID,
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
        },
      ],
    }),
    INITIAL_CONTEXT,
  );
  const invalidStillValid = validateSituationUnderstanding(
    validUnderstanding({
      questions: [
        {
          id: QUESTION_ID_EARLIER_UUID,
          position: 1,
          question: "Was the deposit meant to be returned when you moved out?",
          why_it_matters:
            "Whether return was expected can change what this situation appears to be.",
          ask_now: true,
          materiality: "urgent",
          already_supplied: false,
          action_mode_only: false,
        },
      ],
    }),
    INITIAL_CONTEXT,
  );

  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.understanding.questions[0]?.ask_now, true);
    assert.equal(
      accepted.understanding.questions[0]?.materiality,
      "orientation_fork",
    );
    assert.deepEqual(accepted.understanding.questions[0]?.suggested_options, [
      "Yes, it was to be returned in full",
      "They said some amount could be deducted",
      "I'm not sure",
    ]);
  }
  assert.equal(invalidStillValid.ok, true);
  if (invalidStillValid.ok) {
    assert.equal(
      invalidStillValid.understanding.questions[0]?.clarificationMetadataInvalid,
      true,
    );
  }
});
