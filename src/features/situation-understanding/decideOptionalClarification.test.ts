import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideOptionalClarification,
  isNonMaterialClarificationAnswer,
  selectCurrentClarification,
  selectFinalisedClarifications,
  shouldRunFollowUp,
} from "./decideOptionalClarification.ts";
import { reassessRemainingClarifications } from "./reassessRemainingClarifications.ts";
import {
  extraInventoryQuestion,
  stubLikeInventoryQuestion,
  SYNTHETIC_ASKABLE_QUESTION_ID,
  SYNTHETIC_SECOND_ASKABLE_QUESTION_ID,
  validAskableClarification,
} from "./clarificationTestFixtures.ts";
import type { SituationUnderstanding, StoredQuestion } from "../../types/situationUnderstanding.ts";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";

function orientationUnderstanding(): SituationUnderstanding {
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
  };
}

function storedQuestion(
  overrides: Partial<StoredQuestion> & Pick<StoredQuestion, "id" | "status">,
): StoredQuestion {
  return {
    position: 1,
    question: "Was the deposit meant to be returned when you moved out?",
    why_it_matters:
      "Whether return was expected can change what this situation appears to be.",
    answer: null,
    ...overrides,
  };
}

test("stub-like inventory without orientation_fork metadata is zero optional clarifications", () => {
  const decision = decideOptionalClarification([stubLikeInventoryQuestion()]);
  assert.equal(decision.kind, "zero");
});

test("one valid askable clarification is kept", () => {
  const decision = decideOptionalClarification([
    validAskableClarification(),
    extraInventoryQuestion(),
  ]);
  assert.deepEqual(decision, { kind: "ask", positions: [1] });
});

test("two valid askable clarifications are both kept in order", () => {
  const decision = decideOptionalClarification([
    validAskableClarification(),
    validAskableClarification({
      id: SYNTHETIC_SECOND_ASKABLE_QUESTION_ID,
      position: 2,
      question: "Has the marketplace confirmed that the returned product was accepted?",
      why_it_matters: "Acceptance can change what the next step should be.",
      suggested_options: [
        "Yes, they confirmed it was accepted",
        "It was picked up but they never confirmed inspection",
        "They said there is a problem with the return",
      ],
    }),
  ]);
  assert.deepEqual(decision, { kind: "ask", positions: [1, 2] });
});

test("already supplied or action-mode-only questions are not asked", () => {
  assert.equal(
    decideOptionalClarification([
      validAskableClarification({ already_supplied: true }),
    ]).kind,
    "zero",
  );
  assert.equal(
    decideOptionalClarification([
      validAskableClarification({ action_mode_only: true }),
    ]).kind,
    "zero",
  );
});

test("invalid materiality forces zero asks for the whole inventory", () => {
  const decision = decideOptionalClarification([
    {
      ...validAskableClarification(),
      clarificationMetadataInvalid: true,
    },
    extraInventoryQuestion(),
  ]);
  assert.equal(decision.kind, "zero");
});

test("unfinalised inventory does not surface a clarification carousel", () => {
  const pending = storedQuestion({
    id: SYNTHETIC_ASKABLE_QUESTION_ID,
    status: "pending",
  });

  assert.deepEqual(
    selectFinalisedClarifications({
      view: {
        kind: "understood",
        round: "initial",
        analysisId: ANALYSIS_ID,
        understanding: orientationUnderstanding(),
        questions: [pending],
      },
      askability: null,
    }),
    [],
  );
});

test("finalised keep-questions surface pending current and hide after they are settled", () => {
  const pending = storedQuestion({
    id: SYNTHETIC_ASKABLE_QUESTION_ID,
    status: "pending",
  });
  const view = {
    kind: "understood" as const,
    round: "initial" as const,
    analysisId: ANALYSIS_ID,
    understanding: orientationUnderstanding(),
    questions: [pending],
  };
  const askability = {
    analysisId: ANALYSIS_ID,
    keepQuestionId: SYNTHETIC_ASKABLE_QUESTION_ID,
    keepQuestionIds: [SYNTHETIC_ASKABLE_QUESTION_ID],
  };

  assert.equal(
    selectCurrentClarification(selectFinalisedClarifications({ view, askability }))?.id,
    SYNTHETIC_ASKABLE_QUESTION_ID,
  );
  assert.equal(
    selectCurrentClarification(
      selectFinalisedClarifications({
        view: {
          ...view,
          questions: [
            storedQuestion({
              id: SYNTHETIC_ASKABLE_QUESTION_ID,
              status: "answered",
              answer: "Yes, it was to be returned.",
            }),
          ],
        },
        askability,
      }),
    ),
    null,
  );
});

test("ignored pending clarification stays available and does not trigger follow-up", () => {
  const pending = storedQuestion({
    id: SYNTHETIC_ASKABLE_QUESTION_ID,
    status: "pending",
  });
  const view = {
    kind: "understood" as const,
    round: "initial" as const,
    analysisId: ANALYSIS_ID,
    understanding: orientationUnderstanding(),
    questions: [pending],
  };
  const askability = {
    analysisId: ANALYSIS_ID,
    keepQuestionId: SYNTHETIC_ASKABLE_QUESTION_ID,
    keepQuestionIds: [SYNTHETIC_ASKABLE_QUESTION_ID],
  };

  assert.equal(
    selectCurrentClarification(selectFinalisedClarifications({ view, askability }))
      ?.status,
    "pending",
  );
  assert.equal(
    shouldRunFollowUp({
      view,
      askability,
      answer: "Yes, it was to be returned.",
    }),
    false,
  );
});

test("follow-up runs after the keep-set is settled with a material answer", () => {
  const answered = storedQuestion({
    id: SYNTHETIC_ASKABLE_QUESTION_ID,
    status: "answered",
    answer: "Yes, it was to be returned.",
  });
  const skipped = storedQuestion({
    id: SYNTHETIC_SECOND_ASKABLE_QUESTION_ID,
    position: 2,
    status: "skipped",
    question: "Has the marketplace confirmed that the returned product was accepted?",
    why_it_matters: "Acceptance can change what the next step should be.",
  });
  const view = {
    kind: "understood" as const,
    round: "initial" as const,
    analysisId: ANALYSIS_ID,
    understanding: orientationUnderstanding(),
    questions: [answered, skipped],
  };
  const askability = {
    analysisId: ANALYSIS_ID,
    keepQuestionId: SYNTHETIC_ASKABLE_QUESTION_ID,
    keepQuestionIds: [
      SYNTHETIC_ASKABLE_QUESTION_ID,
      SYNTHETIC_SECOND_ASKABLE_QUESTION_ID,
    ],
  };

  assert.equal(
    shouldRunFollowUp({
      view,
      askability,
      answer: "Yes, it was to be returned.",
    }),
    true,
  );
  assert.equal(
    shouldRunFollowUp({
      view: {
        ...view,
        questions: [
          storedQuestion({
            id: SYNTHETIC_ASKABLE_QUESTION_ID,
            status: "answered",
            answer: "I don't know",
          }),
          skipped,
        ],
      },
      askability,
      answer: "I don't know",
    }),
    false,
  );
  assert.equal(isNonMaterialClarificationAnswer("I'm not sure"), true);
});

test("an answer that already covers a later question causes that question to be skipped", () => {
  const remaining = validAskableClarification({
    id: SYNTHETIC_SECOND_ASKABLE_QUESTION_ID,
    position: 2,
    question: "Has the marketplace confirmed that the returned product was accepted?",
    why_it_matters:
      "Whether the marketplace confirmed acceptance can change the next step.",
  });
  const result = reassessRemainingClarifications({
    remaining: [remaining],
    narrative: "The courier picked up the parcel yesterday.",
    latestAnswer: "Yes, they confirmed it was accepted after inspection.",
  });

  assert.deepEqual(result.skipQuestionIds, [SYNTHETIC_SECOND_ASKABLE_QUESTION_ID]);
});

test("unrelated remaining questions stay after an answer", () => {
  const remaining = validAskableClarification({
    id: SYNTHETIC_SECOND_ASKABLE_QUESTION_ID,
    position: 2,
    question: "Was a written deduction notice given?",
    why_it_matters: "A notice can change whether a deduction appears to be specified.",
  });
  const result = reassessRemainingClarifications({
    remaining: [remaining],
    narrative: "The landlord kept the deposit.",
    latestAnswer: "I moved out in March.",
  });

  assert.deepEqual(result.skipQuestionIds, []);
});
