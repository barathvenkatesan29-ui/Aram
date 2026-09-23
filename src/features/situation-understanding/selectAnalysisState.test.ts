import assert from "node:assert/strict";
import { test } from "node:test";
import { questionsForRpc } from "./questionsForRpc.ts";
import {
  CURRENT_DESCRIPTION,
  FAILED_ID,
  FOLLOW_UP_ID,
  INITIAL_ID,
  MODEL_QUESTION_ID,
  PREVIOUS_DESCRIPTION,
  QUESTION_ID,
  STALE_INITIAL_ID,
  analysisRecord,
  answeredParentQuestion,
  currentDescriptionHash,
  emptyAnswersHash,
  failedInitial,
  hasRevalidatedCurrentComplete,
  parentAnswersHash,
  previousDescriptionHash,
  questionRecord,
  selectView,
  validFollowUpUnderstanding,
  validInitialUnderstanding,
} from "./analysisTestFixtures.ts";

test("RPC mapping strips id and keep only position, question, and why_it_matters", () => {
  const mapped = questionsForRpc([
    {
      id: MODEL_QUESTION_ID,
      position: 1,
      question: "When did this happen?",
      why_it_matters: "A date can show what is still missing.",
      ask_now: true,
      materiality: "orientation_fork",
      already_supplied: false,
      action_mode_only: false,
    },
  ]);

  assert.deepEqual(mapped, [
    {
      position: 1,
      question: "When did this happen?",
      why_it_matters: "A date can show what is still missing.",
    },
  ]);
  assert.equal("id" in mapped[0]!, false);
  assert.equal("status" in mapped[0]!, false);
  assert.equal("answer" in mapped[0]!, false);
  assert.equal("ask_now" in mapped[0]!, false);
  assert.equal("materiality" in mapped[0]!, false);
});

test("current initial is selected by matching description and empty-answer hashes", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [questionRecord()],
  });

  assert.equal(view.kind, "understood");
  if (view.kind === "understood") {
    assert.equal(view.round, "initial");
    assert.equal(view.questions[0]?.id, QUESTION_ID);
    assert.notEqual(view.questions[0]?.id, MODEL_QUESTION_ID);
  }
  assert.equal(hasRevalidatedCurrentComplete(view), true);
});

test("complete row whose description hash does not match is stale", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: STALE_INITIAL_ID,
        round: "initial",
        status: "complete",
        sourceDescriptionHash: previousDescriptionHash,
      }),
    ],
    questions: [questionRecord({ analysisId: STALE_INITIAL_ID })],
  });

  assert.equal(view.kind, "out-of-date");
});

test("failed initial whose description hash does not match is not relevant", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FAILED_ID,
        round: "initial",
        status: "failed",
        failureCode: "invalid-output",
        understanding: null,
        sourceDescriptionHash: previousDescriptionHash,
        sourceAnswersHash: emptyAnswersHash,
      }),
    ],
  });

  assert.equal(view.kind, "not-understood-yet");
});

test("failed initial with current hashes and round initial is relevant", () => {
  const view = selectView({
    analyses: [failedInitial("timeout")],
  });

  assert.equal(view.kind, "could-not-understand");
  if (view.kind === "could-not-understand") {
    assert.equal(view.failureCode, "timeout");
  }
});

test("rerun is blocked only when a current complete row passes revalidation", () => {
  const understood = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [questionRecord()],
  });
  const unrenderable = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
        understanding: { not: "valid" },
      }),
    ],
    questions: [questionRecord()],
  });

  assert.equal(hasRevalidatedCurrentComplete(understood), true);
  assert.equal(unrenderable.kind, "unrenderable");
  assert.equal(hasRevalidatedCurrentComplete(unrenderable), false);
  assert.equal(
    hasRevalidatedCurrentComplete({ kind: "could-not-understand", failureCode: "timeout" }),
    false,
  );
  assert.equal(hasRevalidatedCurrentComplete({ kind: "out-of-date" }), false);
  assert.equal(hasRevalidatedCurrentComplete({ kind: "not-understood-yet" }), false);
});

test("newest current-hash complete that fails revalidation does not block rerun", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
        understanding: validInitialUnderstanding({ questions: [] }),
      }),
    ],
    questions: [questionRecord()],
  });

  assert.equal(view.kind, "unrenderable");
  assert.equal(hasRevalidatedCurrentComplete(view), false);
});

test("follow-up currentness uses parent initial questions ordered by position", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: currentDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [answeredParentQuestion()],
  });

  assert.equal(view.kind, "understood");
  if (view.kind === "understood") {
    assert.equal(view.round, "follow_up");
    assert.equal(view.questions.length, 0);
    assert.equal(
      view.understanding.userFacts.some(
        (fact) => fact.source_kind === "answer" && fact.source_question_id === QUESTION_ID,
      ),
      true,
    );
  }
});

test("stale-description follow-up is not unrenderable", () => {
  const view = selectView({
    description: CURRENT_DESCRIPTION,
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: STALE_INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: previousDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: STALE_INITIAL_ID,
        round: "initial",
        status: "complete",
        sourceDescriptionHash: previousDescriptionHash,
      }),
    ],
    questions: [
      questionRecord({
        analysisId: STALE_INITIAL_ID,
        status: "answered",
        answer: "March 2026",
      }),
    ],
  });

  assert.equal(view.kind, "out-of-date");
  assert.equal(hasRevalidatedCurrentComplete(view), false);
});

test("stale-description follow-up does not hide a current initial", () => {
  const view = selectView({
    description: CURRENT_DESCRIPTION,
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: STALE_INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: previousDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [questionRecord()],
  });

  assert.equal(view.kind, "understood");
  if (view.kind === "understood") {
    assert.equal(view.round, "initial");
  }
});

test("current-description follow-up with wrong answer hash is unrenderable and does not fall back to the initial", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: currentDescriptionHash,
        sourceAnswersHash: emptyAnswersHash,
      }),
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [answeredParentQuestion()],
  });

  assert.equal(view.kind, "unrenderable");
  assert.equal(hasRevalidatedCurrentComplete(view), false);
});

test("current-description follow-up with missing parent is unrenderable and does not fall back", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: currentDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: STALE_INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [questionRecord({ analysisId: STALE_INITIAL_ID })],
  });

  assert.equal(view.kind, "unrenderable");
  assert.equal(hasRevalidatedCurrentComplete(view), false);
});

test("current-description follow-up with invalid parent is unrenderable and does not fall back", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: currentDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "failed",
        failureCode: "timeout",
        understanding: null,
      }),
    ],
  });

  assert.equal(view.kind, "unrenderable");
  assert.equal(hasRevalidatedCurrentComplete(view), false);
});

test("follow-up with any question rows fails closed", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: INITIAL_ID,
        understanding: validFollowUpUnderstanding(),
        sourceDescriptionHash: currentDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [
      answeredParentQuestion(),
      questionRecord({
        id: "77777777-7777-4777-8777-777777777777",
        analysisId: FOLLOW_UP_ID,
        position: 1,
      }),
    ],
  });

  assert.equal(view.kind, "unrenderable");
  assert.equal(hasRevalidatedCurrentComplete(view), false);
});

test("follow-up understanding with answer provenance is checked against parent canonical answers", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: FOLLOW_UP_ID,
        round: "follow_up",
        status: "complete",
        parentAnalysisId: INITIAL_ID,
        understanding: validFollowUpUnderstanding({
          userFacts: [
            {
              text: "The user said this happened in March.",
              quote: "March 2026",
              source_kind: "answer",
              source_question_id: "not-a-uuid",
            },
          ],
        }),
        sourceDescriptionHash: currentDescriptionHash,
        sourceAnswersHash: parentAnswersHash(),
      }),
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [answeredParentQuestion()],
  });

  assert.equal(view.kind, "unrenderable");
});

test("corrupt understanding JSON fails closed", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
        understanding: { userFacts: "nope" },
      }),
    ],
    questions: [questionRecord()],
  });

  assert.equal(view.kind, "unrenderable");
});

test("question positions with a gap fail closed", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
        understanding: validInitialUnderstanding({
          questions: [
            {
              id: MODEL_QUESTION_ID,
              position: 1,
              question: "When did this happen?",
              why_it_matters: "A date can show what is still missing.",
            },
            {
              id: "99999999-9999-4999-8999-999999999999",
              position: 2,
              question: "Where did this happen?",
              why_it_matters: "A place can show what is still missing.",
            },
          ],
        }),
      }),
    ],
    questions: [
      questionRecord(),
      questionRecord({
        id: "99999999-9999-4999-8999-999999999999",
        position: 3,
        question: "Where did this happen?",
        whyItMatters: "A place can show what is still missing.",
      }),
    ],
  });

  assert.equal(view.kind, "unrenderable");
});

test("stale old success plus a relevant current failed initial resolves to Could not understand", () => {
  const view = selectView({
    description: CURRENT_DESCRIPTION,
    analyses: [
      failedInitial("invalid-output"),
      analysisRecord({
        id: STALE_INITIAL_ID,
        round: "initial",
        status: "complete",
        sourceDescriptionHash: previousDescriptionHash,
      }),
    ],
    questions: [questionRecord({ analysisId: STALE_INITIAL_ID })],
  });

  assert.equal(view.kind, "could-not-understand");
});

test("stale old success with no current failed attempt resolves to Out of date", () => {
  const view = selectView({
    description: CURRENT_DESCRIPTION,
    analyses: [
      analysisRecord({
        id: STALE_INITIAL_ID,
        round: "initial",
        status: "complete",
        sourceDescriptionHash: previousDescriptionHash,
      }),
    ],
    questions: [questionRecord({ analysisId: STALE_INITIAL_ID })],
  });

  assert.equal(view.kind, "out-of-date");
});

test("view types have no numeric version field", () => {
  const view = selectView({
    analyses: [
      analysisRecord({
        id: INITIAL_ID,
        round: "initial",
        status: "complete",
      }),
    ],
    questions: [questionRecord()],
  });

  assert.equal(Object.prototype.hasOwnProperty.call(view, "version"), false);
  assert.equal(CURRENT_DESCRIPTION.includes("version"), false);
  assert.equal(PREVIOUS_DESCRIPTION.includes("version"), false);
});
