import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProvisionalNarrative,
  isIntelligenceReady,
  MAX_SITUATION_NARRATIVE_LENGTH,
  narrativeExceedsLimit,
  PRE_UNDERSTANDING_NARRATIVE_SEPARATOR,
} from "./provisionalNarrative.ts";
import { validateUserMessage } from "./validateUserMessage.ts";
import {
  firstPendingQuestion,
  frozenComposerBody,
  projectAramTurn,
  shouldAppendPreUnderstanding,
  shouldAttemptInitialUnderstanding,
} from "./projectAramTurn.ts";
import { projectOrientation } from "./projectOrientation.ts";
import {
  CLOSED_ACTION_MESSAGE,
  FROZEN_FREE_TEXT_MESSAGE,
  looksLikeClosedActionRequest,
} from "./closedActionRequest.ts";
import {
  deriveConversationTitle,
  shouldWriteConversationTitle,
} from "./deriveConversationTitle.ts";
import {
  conversationDisplayTitle,
  groupConversationsByRecency,
} from "./groupConversations.ts";
import { toFriendlySituationPanel } from "./situationPanelModel.ts";
import type { StoredQuestion } from "../../types/situationUnderstanding.ts";

test("1-character first message is accepted for conversation creation", () => {
  assert.equal(validateUserMessage("H").ok, true);
  assert.equal(validateUserMessage(" ").ok, false);
  assert.equal(validateUserMessage("").ok, false);
});

test("sub-50 narrative is not intelligence-ready and does not attempt understanding", () => {
  const shortNarrative = "Help with rent";
  assert.equal(shortNarrative.trim().length < 50, true);
  assert.equal(isIntelligenceReady(shortNarrative), false);
  assert.equal(
    shouldAttemptInitialUnderstanding({
      description: shortNarrative,
      isFrozen: false,
    }),
    false,
  );
});

test("crossing 50 characters makes the narrative eligible for understanding", () => {
  const readyNarrative = "a".repeat(50);
  assert.equal(isIntelligenceReady(readyNarrative), true);
  assert.equal(
    shouldAttemptInitialUnderstanding({
      description: readyNarrative,
      isFrozen: false,
    }),
    true,
  );
  assert.equal(
    shouldAttemptInitialUnderstanding({
      description: readyNarrative,
      isFrozen: true,
    }),
    false,
  );
});

test("provisional narrative concatenates eligible messages deterministically", () => {
  assert.equal(PRE_UNDERSTANDING_NARRATIVE_SEPARATOR, "\n\n");
  assert.equal(
    buildProvisionalNarrative(["  Help  ", "Landlord kept the deposit."]),
    "Help\n\nLandlord kept the deposit.",
  );
  assert.equal(
    buildProvisionalNarrative(["second", "first"].sort()),
    "first\n\nsecond",
  );
});

test("8000 overflow is rejected for the rebuilt narrative", () => {
  const first = "a".repeat(7999);
  const second = "bb";
  assert.equal(buildProvisionalNarrative([first, second]).length > 8000, true);
  assert.equal(narrativeExceedsLimit([first, second]), true);
  assert.equal(
    narrativeExceedsLimit(["a".repeat(MAX_SITUATION_NARRATIVE_LENGTH)]),
    false,
  );
});

test("revalidated complete understanding freezes pre-understanding appends", () => {
  assert.equal(shouldAppendPreUnderstanding(false), true);
  assert.equal(shouldAppendPreUnderstanding(true), false);
});

test("projected Aram turn asks for more detail below the readiness threshold", () => {
  const projected = projectAramTurn({
    description: "Help",
    availability: "available",
    view: { kind: "not-understood-yet" },
  });
  assert.equal(
    projected.body,
    "Please describe a little more about what happened.",
  );
});

test("projected Aram turn shows orientation, not the first pending inventory question", () => {
  const questions: StoredQuestion[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      position: 2,
      question: "Second question?",
      why_it_matters: "Later.",
      status: "pending",
      answer: null,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      position: 1,
      question: "When did this happen?",
      why_it_matters: "A date can show what is still missing.",
      status: "pending",
      answer: null,
    },
  ];

  assert.equal(firstPendingQuestion(questions)?.question, "When did this happen?");

  const projected = projectAramTurn({
    description: "a".repeat(50),
    availability: "available",
    view: {
      kind: "understood",
      round: "initial",
      analysisId: "11111111-1111-4111-8111-111111111111",
      understanding: {
        userFacts: [
          {
            text: "The landlord kept the rental deposit.",
            quote: "kept the rental deposit",
            source_kind: "description",
            source_question_id: null,
          },
        ],
        parties: [{ label: "landlord", role: "other party" }],
        inferences: [],
        assumptions: [],
        situationThemes: [{ text: "rental deposit" }],
        missingInformation: [
          { text: "Whether any specific damage is being claimed is not stated." },
        ],
        uncertainties: [],
        questions: [],
      },
      questions,
    },
  });

  assert.equal(projected.body.includes("When did this happen?"), false);
  assert.equal(projected.body.includes("Second question?"), false);
  assert.equal(projected.body.includes("What's happening"), true);
  assert.equal(projected.body.includes("The landlord kept the rental deposit."), true);
  assert.equal(projected.body.includes("What matters"), false);
  assert.equal(projected.body.includes("Still uncertain"), false);
  assert.equal(projected.orientation !== null, true);
  assert.deepEqual(projected.orientation?.stillUnclear, []);
});

test("orientation copy does not invent law", () => {
  const body = projectOrientation({
    userFacts: [{ text: "The neighbour locked the gate.", quote: "locked the gate", source_kind: "description", source_question_id: null }],
    parties: [{ label: "Neighbour", role: "other person" }],
    inferences: [],
    assumptions: [],
    situationThemes: [{ text: "A neighbour dispute" }],
    missingInformation: [{ text: "The date is missing." }],
    uncertainties: [],
    questions: [],
  });

  assert.equal(/\b(liable|statute|section\s*\d+|your rights|file a case)\b/i.test(body), false);
  assert.equal(body.includes("What's happening"), true);
  assert.equal(body.includes("I have organised what you have shared so far."), false);
});

test("title stays null before the first complete understanding", () => {
  assert.equal(shouldWriteConversationTitle(null), true);
  assert.equal(shouldWriteConversationTitle("   "), true);
  assert.equal(shouldWriteConversationTitle("Landlord kept my deposit"), false);
});

test("first thin message plus later detail titles from the accumulated frozen narrative", () => {
  const frozenNarrative = buildProvisionalNarrative([
    "h",
    "My landlord has not returned my ₹40,000 security deposit after I moved out.",
  ]);
  const title = deriveConversationTitle(frozenNarrative);

  assert.notEqual(title, null);
  assert.notEqual(title, "h");
  assert.equal(title?.startsWith("h"), false);
  assert.equal(title?.includes("landlord"), true);
  assert.equal(title?.includes("deposit"), true);
  assert.equal(title, deriveConversationTitle(frozenNarrative));
});

test("frozen composer stays in organised mode and does not hijack with a pending question", () => {
  const completeCopy = frozenComposerBody();

  assert.equal(completeCopy, "I have organised what you have shared so far.");
  assert.equal(completeCopy.includes("When did this happen?"), false);
  assert.equal(completeCopy.includes("Answering questions is not open"), false);
  assert.equal(looksLikeClosedActionRequest("Please send a notice tomorrow."), true);
  assert.equal(looksLikeClosedActionRequest("The landlord kept the deposit."), false);
  assert.equal(CLOSED_ACTION_MESSAGE.includes("not open yet"), true);
  assert.equal(FROZEN_FREE_TEXT_MESSAGE.includes("already organised"), true);
});

test("existing title is not regenerated on refresh", () => {
  assert.equal(shouldWriteConversationTitle("h"), false);
  assert.equal(
    shouldWriteConversationTitle("Landlord kept my deposit after I moved out."),
    false,
  );
  assert.equal(
    conversationDisplayTitle({
      id: "77777777-7777-4777-8777-777777777777",
      title: "h My landlord kept the security deposit after I",
      created_at: "2026-09-20T04:30:00.000Z",
      updated_at: "2026-09-20T04:30:00.000Z",
      archived_at: null,
    }),
    "h My landlord kept the security deposit after I",
  );
});

test("title sanitisation still rejects empty, URL, and legal-claiming copy", () => {
  assert.equal(deriveConversationTitle(""), null);
  assert.equal(deriveConversationTitle("https://example.com/case"), null);
  assert.equal(deriveConversationTitle("Your rights under the statute"), null);
  assert.equal(
    deriveConversationTitle("Landlord kept my deposit after I moved out."),
    "Landlord kept my deposit after I moved out.",
  );
});

test("conversation list uses the title when present and otherwise a date label", () => {
  const titled = conversationDisplayTitle({
    id: "33333333-3333-4333-8333-333333333333",
    title: "Landlord kept my deposit",
    created_at: "2026-09-20T04:30:00.000Z",
    updated_at: "2026-09-20T04:30:00.000Z",
    archived_at: null,
  });
  const untitled = conversationDisplayTitle({
    id: "44444444-4444-4444-8444-444444444444",
    title: null,
    created_at: "2026-09-20T04:30:00.000Z",
    updated_at: "2026-09-20T04:30:00.000Z",
    archived_at: null,
  });

  assert.equal(titled, "Landlord kept my deposit");
  assert.equal(untitled.startsWith("Case ·"), true);
});

test("conversations group by recency in IST", () => {
  const now = new Date("2026-09-20T15:30:00.000Z");
  const groups = groupConversationsByRecency(
    [
      {
        id: "55555555-5555-4555-8555-555555555555",
        title: "Today item",
        created_at: "2026-09-20T10:00:00.000Z",
        updated_at: "2026-09-20T10:00:00.000Z",
        archived_at: null,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        title: "Older item",
        created_at: "2026-08-01T10:00:00.000Z",
        updated_at: "2026-08-01T10:00:00.000Z",
        archived_at: null,
      },
    ],
    now,
  );

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Today", "Older"],
  );
});

test("friendly situation panel hides empty money timeline evidence and want sections", () => {
  const panel = toFriendlySituationPanel({
    understanding: {
      userFacts: [{ text: "The neighbour locked the gate.", quote: "locked the gate", source_kind: "description", source_question_id: null }],
      parties: [{ label: "Neighbour", role: "other person" }],
      inferences: [],
      assumptions: [],
      situationThemes: [{ text: "A neighbour dispute" }],
      missingInformation: [{ text: "The date is missing." }],
      uncertainties: [],
      questions: [],
    },
    questions: [],
  });

  assert.deepEqual(panel.summary, ["The neighbour locked the gate."]);
  assert.deepEqual(panel.peopleInvolved, ["Neighbour — other person"]);
  assert.deepEqual(panel.moneyInvolved, []);
  assert.deepEqual(panel.timeline, []);
  assert.deepEqual(panel.evidence, []);
  assert.deepEqual(panel.whatYouWant, []);
  assert.deepEqual(panel.stillUnclear, []);
});
