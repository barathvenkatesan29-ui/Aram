import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { organiseStubSituation } from "../../server/ai/organiseStubSituation.ts";
import {
  DEPRECATED_CONVERSATION_ACTION_LABELS,
  FUTURE_CONVERSATION_ACTION_LABELS,
  formatEvidencePreviewLine,
  formatOrientationBody,
  orientationContainsLegalCopy,
  projectOrientationModel,
  selectRecommendedNextAction,
} from "./orientationModel.ts";
import { projectOrientation } from "./projectOrientation.ts";
import { toDetailsWorkspaceModel } from "./detailsWorkspaceModel.ts";
import { closeBrowserTab, openOrReuseBrowserTab } from "./browserTabs.ts";
import {
  clampLeftWidth,
  clampRightWidth,
  LEFT_PANEL_MAX,
  LEFT_PANEL_MIN,
  RIGHT_PANEL_MAX,
  RIGHT_PANEL_MIN,
  rightPanelDensity,
  shouldUseOverlay,
} from "./panelWidth.ts";

const directory = dirname(fileURLToPath(import.meta.url));

const DEPOSIT_DESCRIPTION =
  "My landlord has not returned my ₹40,000 security deposit after I moved out. I handed over the house and there was no major damage. I have already asked for the deposit back, but the landlord keeps delaying and has not clearly explained why the money is being withheld. I have proof that I paid the deposit and messages where I asked for the refund. I want to understand what my situation is and what I can reasonably do next.";

const REFUND_DESCRIPTION =
  "I returned a laptop I bought online because it arrived with a damaged screen. The return pickup was completed, but the marketplace says the refund is still under review. The seller says they are waiting for the marketplace, and support keeps giving me different answers. I have the invoice, return approval, pickup confirmation, photos of the damage, and support screenshots.";

const EMPLOYMENT_DESCRIPTION =
  "My employer deducted ₹8,000 from my salary this month without a written explanation. HR says it is a policy deduction but has not shared the breakdown. I have my offer letter, payslips, and the bank statement showing the lower credit.";

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0).length;
}

function projectScenario(description: string) {
  const understanding = organiseStubSituation({ description });
  const model = projectOrientationModel({ description, understanding });
  const details = toDetailsWorkspaceModel({ description, understanding });
  return { understanding, model, details };
}

function assertNoDeprecatedCtas(value: string): void {
  for (const label of DEPRECATED_CONVERSATION_ACTION_LABELS) {
    assert.equal(value.includes(label), false, `deprecated CTA still present: ${label}`);
  }
}

test("orientation for a supplied deposit story is useful without questions or law", () => {
  const { model } = projectScenario(DEPOSIT_DESCRIPTION);

  assert.equal(model.whatsHappening.includes("₹40,000"), true);
  assert.equal(/landlord/i.test(model.whatsHappening), true);
  assert.ok(sentenceCount(model.whatsHappening) >= 1);
  assert.ok(sentenceCount(model.whatsHappening) <= 4);
  assert.equal(
    model.standing.inYourFavour.some((point) => /security deposit|no major damage|proof of payment/i.test(point)),
    true,
  );
  assert.equal(model.nextSteps.length >= 2, true);
  assert.equal(
    model.nextSteps.some(
      (step) => /deposit return/i.test(step.text) && step.why.length > 0,
    ),
    true,
  );
  assert.equal(
    model.nextSteps.some((step) => step.action?.kind === "show-draft"),
    true,
  );
  assert.equal(
    model.whatYouShouldntDo.some((item) => /do not delete/i.test(item)),
    true,
  );
  assert.equal(
    /not returned the deposit|not clearly explained/i.test(model.standing.currentObstacle ?? ""),
    true,
  );
  assert.equal(model.standing.currentAssumption, null);
  assert.equal(model.helpNext.length, 0);
  assert.equal(model.legalPosition.ready, false);
  assert.equal(/when did this happen/i.test(JSON.stringify(model)), false);
  assert.equal(orientationContainsLegalCopy(JSON.stringify(model)), false);
  assert.equal(model.actions.length, 0);
  assertNoDeprecatedCtas(JSON.stringify(model));
  assert.equal(
    FUTURE_CONVERSATION_ACTION_LABELS.some((label) =>
      model.helpNext.some((item) => item.label === label),
    ),
    false,
  );
});

test("marketplace refund orientation stays distinct from the landlord deposit template", () => {
  const depositUnderstanding = organiseStubSituation({
    description: DEPOSIT_DESCRIPTION,
  });
  const refundUnderstanding = organiseStubSituation({
    description: REFUND_DESCRIPTION,
  });
  const deposit = projectOrientationModel({
    description: DEPOSIT_DESCRIPTION,
    understanding: depositUnderstanding,
  });
  const refund = projectOrientationModel({
    description: REFUND_DESCRIPTION,
    understanding: refundUnderstanding,
  });
  const depositDetails = toDetailsWorkspaceModel({
    description: DEPOSIT_DESCRIPTION,
    understanding: depositUnderstanding,
  });
  const refundDetails = toDetailsWorkspaceModel({
    description: REFUND_DESCRIPTION,
    understanding: refundUnderstanding,
  });

  assert.equal(/laptop|damaged screen/i.test(refund.whatsHappening), true);
  assert.equal(/landlord/i.test(refund.whatsHappening), false);
  assert.equal(/laptop/i.test(deposit.whatsHappening), false);
  assert.ok(sentenceCount(refund.whatsHappening) <= 4);

  assert.equal(
    refund.standing.inYourFavour.some((point) => /product arrived damaged/i.test(point)),
    true,
  );
  assert.equal(
    refund.standing.inYourFavour.some((point) => /return was approved/i.test(point)),
    true,
  );
  assert.equal(
    refund.standing.inYourFavour.some((point) => /pickup has already happened/i.test(point)),
    true,
  );
  assert.equal(
    refund.standing.inYourFavour.some((point) => /invoice|return approval|pickup confirmation/i.test(point)),
    true,
  );
  assert.equal(
    refund.standing.inYourFavour.some((point) => /refund is still under review/i.test(point)),
    false,
  );
  assert.equal(
    refund.standing.inYourFavour.some((point) =>
      /seller and marketplace are pointing responsibility/i.test(point),
    ),
    false,
  );
  assert.equal(
    refund.standing.inYourFavour.some((point) => /security deposit|handed back without major damage/i.test(point)),
    false,
  );
  assert.equal(
    deposit.standing.inYourFavour.some((point) => /product arrived damaged|under review/i.test(point)),
    false,
  );

  assert.equal(
    refund.nextSteps.some(
      (step) =>
        /put your refund demand in writing/i.test(step.text) &&
        step.why.length > 0 &&
        step.action?.kind === "show-draft" &&
        step.action.label === "Draft refund request",
    ),
    true,
  );
  assert.equal(
    refund.nextSteps.some(
      (step) =>
        /return inspection is complete/i.test(step.text) &&
        step.action?.kind === "show-draft" &&
        step.action.label === "Prepare follow-up",
    ),
    true,
  );
  assert.equal(
    refund.nextSteps.some(
      (step) =>
        /official support or escalation route/i.test(step.text) &&
        step.action === null,
    ),
    true,
  );
  assert.equal(
    refund.nextSteps.some((step) => step.action?.kind === "view-evidence"),
    false,
  );
  assert.equal(
    refund.nextSteps.some((step) =>
      /explore options|learn more|ask for (an )?explanation|withheld|itemised|itemized|deduction being claimed/i.test(
        step.text,
      ),
    ),
    false,
  );
  assert.equal(
    deposit.nextSteps.some((step) =>
      /marketplace|return inspection|refund demand/i.test(step.text),
    ),
    false,
  );
  assert.equal(
    refund.nextSteps.some((step) => step.action?.kind === "open-verified-source"),
    false,
  );
  assert.equal(/https?:\/\//i.test(JSON.stringify(refund.nextSteps)), false);

  assert.equal(
    /refund is still under review/i.test(refund.standing.currentObstacle ?? ""),
    true,
  );
  assert.equal(
    /return pickup is being treated as completed/i.test(refund.standing.currentAssumption ?? ""),
    true,
  );
  assert.equal(
    /not returned the deposit|not clearly explained/i.test(deposit.standing.currentObstacle ?? ""),
    true,
  );
  assert.equal(deposit.standing.currentAssumption, null);
  assert.equal(refundUnderstanding.questions.length, 0);
  assert.equal(refund.legalPosition.ready, false);
  assert.equal(refund.helpNext.length, 0);
  assert.equal(
    refund.nextSteps.some((step) => step.action?.label === "Draft refund request"),
    true,
  );
  assert.equal(
    refund.helpNext.some((item) => item.label === "Draft refund request"),
    false,
  );
  assert.equal(
    refund.helpNext.some((item) => item.label === "Prepare follow-up"),
    false,
  );

  assert.deepEqual(refundDetails.evidence, [
    "Invoice",
    "Return approval",
    "Pickup confirmation",
    "Photos of damaged screen/product",
    "Support conversation screenshots",
  ]);
  assert.equal(depositDetails.evidence.some((item) => /invoice/i.test(item)), false);
  assert.equal(
    depositDetails.evidence.some((item) => /proof of payment/i.test(item)),
    true,
  );
  assert.equal(
    depositDetails.evidence.some((item) => /messages requesting the refund/i.test(item)),
    true,
  );

  assert.equal(refund.actions.length, 0);
  assertNoDeprecatedCtas(JSON.stringify(refund));
  assertNoDeprecatedCtas(JSON.stringify(deposit));
});

test("centre response follows the result architecture order", () => {
  const { model, details } = projectScenario(REFUND_DESCRIPTION);
  const body = formatOrientationBody(model);
  const happening = body.indexOf("What's happening");
  const standing = body.indexOf("Where you currently stand");
  const steps = body.indexOf("Sensible next steps");
  const avoid = body.indexOf("What you shouldn't do");
  const evidence = body.indexOf("Evidence identified");
  const legal = body.indexOf("Your legal position");
  const helpNext = body.indexOf("Aram can help you next");
  const recommended = body.indexOf("Recommended next action");
  const card = readFileSync(join(directory, "OrientationCard.tsx"), "utf8");
  const browser = readFileSync(join(directory, "BrowserWorkspace.tsx"), "utf8");
  const conversationChat = readFileSync(join(directory, "ConversationChat.tsx"), "utf8");
  const detailsPanel = readFileSync(join(directory, "DetailsPanel.tsx"), "utf8");

  assert.ok(happening !== -1 && happening < standing);
  assert.ok(standing !== -1 && standing < steps);
  assert.ok(steps !== -1 && steps < avoid);
  assert.ok(avoid !== -1 && avoid < evidence);
  assert.equal(legal, -1);
  assert.equal(helpNext, -1);
  assert.ok(evidence !== -1 && evidence < recommended);
  assert.equal(body.includes("What matters"), false);
  assert.equal(body.includes("Still uncertain"), false);
  assert.equal(body.includes("Still unclear"), false);
  assert.equal(body.includes("What I'm going with"), false);
  assert.equal(body.includes("A few details could make this more precise"), false);
  assert.equal(body.includes("In your favour"), true);
  assert.equal(body.includes("Current obstacle"), true);
  assert.equal(body.includes("Aram's current assumption"), true);
  assert.equal(card.includes("What matters"), false);
  assert.equal(card.includes("Still uncertain"), false);
  assert.equal(card.includes("Where you currently stand"), true);
  assert.equal(card.includes("Current obstacle"), true);
  assert.equal(card.includes("Aram"), true);
  assert.equal(card.includes("What you shouldn"), true);
  assert.equal(card.includes("A few details could make this more precise"), true);
  assert.equal(card.includes("uppercase"), false);
  assert.equal(card.includes("text-xl font-semibold"), true);
  assert.equal(card.includes("model.legalPosition.ready"), true);
  assert.equal(card.includes("model.helpNext.length > 0"), true);
  assert.equal(card.includes("Evidence identified"), true);
  assert.equal(card.includes("useState(false)"), true);
  assert.equal(card.includes("aria-expanded"), true);
  assert.equal(card.includes("View all in Details"), true);
  assert.equal(card.includes("Recommended next action"), true);
  assert.equal(card.includes("sm:flex-row sm:items-start sm:justify-between"), false);
  assert.equal(card.includes("contextualStepAction"), true);
  assert.equal(detailsPanel.includes("What still matters"), false);
  assert.equal(conversationChat.includes("precisionSlot"), true);
  assert.equal(conversationChat.includes("embedded"), true);
  assert.deepEqual(details.keyDetails, model.standing.inYourFavour);
  assert.deepEqual(details.stillUnclear, []);
  assert.equal(details.evidence.length >= 5, true);
  assert.equal(model.evidence.count, details.evidence.length);
  assert.equal(model.evidence.preview.length <= 3, true);
  assert.equal(
    formatEvidencePreviewLine(model.evidence),
    "Invoice, Return approval, Pickup confirmation +2",
  );
  assert.equal(body.includes("Evidence identified · 5"), true);
  assert.equal(body.includes("Invoice, Return approval, Pickup confirmation +2"), true);
  assert.equal(model.legalPosition.ready, false);
  assert.equal(model.legalPosition.issue, null);
  assert.equal(model.whatYouShouldntDo.some((item) => /OTP/i.test(item)), true);
  assert.equal(
    /\b(statute|section\s*\d+|liable|waiver|deadline|consumer forum)\b/i.test(
      JSON.stringify(model.whatYouShouldntDo),
    ),
    false,
  );
  assert.equal(
    FUTURE_CONVERSATION_ACTION_LABELS.some((label) => body.includes(label)),
    false,
  );
  assert.ok(browser.includes("<iframe"));
  assert.ok(browser.includes("Open externally"));
  assert.ok(browser.includes("The conversation stays where"));
});

test("employment deduction orientation stays distinct from housing and marketplace", () => {
  const { model, details, understanding } = projectScenario(EMPLOYMENT_DESCRIPTION);

  assert.equal(/employer|salary|₹8,000/i.test(model.whatsHappening), true);
  assert.equal(/landlord|marketplace|laptop/i.test(model.whatsHappening), false);
  assert.ok(sentenceCount(model.whatsHappening) <= 4);
  assert.equal(
    model.standing.inYourFavour.some((point) => /₹8,000 salary deduction/i.test(point)),
    true,
  );
  assert.equal(
    model.standing.inYourFavour.some((point) => /offer letter|payslips|bank statement/i.test(point)),
    true,
  );
  assert.equal(
    model.standing.inYourFavour.some((point) => /security deposit|damaged screen|pickup/i.test(point)),
    false,
  );
  assert.equal(
    model.nextSteps.some(
      (step) =>
        /itemised written breakdown of the salary deduction/i.test(step.text) &&
        step.why.length > 0 &&
        step.action?.kind === "show-draft",
    ),
    true,
  );
  assert.equal(
    model.nextSteps.some((step) => /deposit return|refund demand|marketplace/i.test(step.text)),
    false,
  );
  assert.equal(
    model.whatYouShouldntDo.some((item) => /offer letter|payslips|bank statement/i.test(item)),
    true,
  );
  assert.equal(
    model.whatYouShouldntDo.some((item) => /landlord|refund|deposit payment proof/i.test(item)),
    false,
  );
  assert.equal(
    /written breakdown of the salary deduction/i.test(model.standing.currentObstacle ?? ""),
    true,
  );
  assert.equal(model.standing.currentAssumption, null);
  assert.equal(
    /inspection|security deposit|owns the refund/i.test(model.standing.currentObstacle ?? ""),
    false,
  );
  assert.deepEqual(details.evidence, ["Offer letter", "Payslips", "Bank statement"]);
  assert.equal(model.evidence.count, 3);
  assert.equal(model.legalPosition.ready, false);
  assert.equal(understanding.questions.length, 0);
  assert.equal(
    understanding.parties.some((party) => party.label === "employer"),
    true,
  );
  assert.equal(
    understanding.parties.some((party) => party.label === "hr"),
    true,
  );
  assert.equal(
    understanding.parties.some((party) => party.label === "bank"),
    false,
  );
  assertNoDeprecatedCtas(JSON.stringify(model));
});

test("landlord, refund, and employment results differ across the centre sections", () => {
  const deposit = projectScenario(DEPOSIT_DESCRIPTION).model;
  const refund = projectScenario(REFUND_DESCRIPTION).model;
  const employment = projectScenario(EMPLOYMENT_DESCRIPTION).model;

  assert.notEqual(deposit.whatsHappening, refund.whatsHappening);
  assert.notEqual(refund.whatsHappening, employment.whatsHappening);
  assert.notEqual(deposit.whatsHappening, employment.whatsHappening);
  assert.notDeepEqual(deposit.standing, refund.standing);
  assert.notDeepEqual(refund.standing, employment.standing);
  assert.notDeepEqual(deposit.standing, employment.standing);
  assert.notDeepEqual(
    deposit.nextSteps.map((step) => step.text),
    refund.nextSteps.map((step) => step.text),
  );
  assert.notDeepEqual(
    refund.nextSteps.map((step) => step.text),
    employment.nextSteps.map((step) => step.text),
  );
  assert.notDeepEqual(deposit.whatYouShouldntDo, refund.whatYouShouldntDo);
  assert.notDeepEqual(refund.whatYouShouldntDo, employment.whatYouShouldntDo);
  assert.notDeepEqual(deposit.evidence.preview, refund.evidence.preview);
  assert.notDeepEqual(refund.evidence.preview, employment.evidence.preview);
  assert.notEqual(deposit.standing.currentObstacle, refund.standing.currentObstacle);
  assert.notEqual(refund.standing.currentObstacle, employment.standing.currentObstacle);
  assert.notEqual(deposit.standing.currentObstacle, employment.standing.currentObstacle);
  assert.notEqual(deposit.standing.currentAssumption, refund.standing.currentAssumption);
});

test("deprecated generic CTAs are removed from orientation UI surfaces", () => {
  for (const fileName of [
    "OrientationCard.tsx",
    "DetailsPanel.tsx",
    "ConversationWorkspace.tsx",
    "ConversationChat.tsx",
    "situationFromDescription.ts",
  ]) {
    const source = readFileSync(
      fileName === "situationFromDescription.ts"
        ? join(directory, "../situation-understanding/situationFromDescription.ts")
        : join(directory, fileName),
      "utf8",
    );
    assertNoDeprecatedCtas(source);
  }
});

test("thin stored stub output still orients from the frozen description", () => {
  const model = projectOrientationModel({
    description: DEPOSIT_DESCRIPTION,
    understanding: {
      userFacts: [
        {
          text: "The user described a situation.",
          quote: "My landlord has not returned my ₹40,000 security deposit",
          source_kind: "description",
          source_question_id: null,
        },
      ],
      parties: [],
      inferences: [],
      assumptions: [],
      situationThemes: [{ text: "needs examination" }],
      missingInformation: [{ text: "The date is missing." }],
      uncertainties: [],
      questions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          position: 1,
          question: "When did this happen?",
          why_it_matters: "A rough date can show what is still missing.",
        },
      ],
    },
  });

  assert.equal(model.whatsHappening.includes("The user described a situation."), false);
  assert.equal(model.whatsHappening.includes("₹40,000"), true);
  assert.equal(/when did this happen/i.test(model.whatsHappening), false);
  assert.equal(
    model.stillUnclear.some((item) => /date is missing/i.test(item)),
    false,
  );
});

test("details hide empty attachments and collect user-supplied links", () => {
  const description = `${DEPOSIT_DESCRIPTION} See https://example.com/guidance`;
  const details = toDetailsWorkspaceModel({
    description,
    understanding: organiseStubSituation({ description: DEPOSIT_DESCRIPTION }),
  });

  assert.deepEqual(details.attachments, []);
  assert.equal(details.links.length, 1);
  assert.equal(details.links[0]?.url, "https://example.com/guidance");
  assert.equal(details.links[0]?.provenance, "user-supplied");
  assert.equal(details.overview.length > 0, true);
});

test("browser tabs reuse the same URL and return to empty after the last close", () => {
  const first = openOrReuseBrowserTab([], {
    url: "https://example.com/a",
    title: "Guidance",
  });
  const second = openOrReuseBrowserTab(first.tabs, {
    url: "https://example.com/a",
    title: "Guidance again",
  });
  const third = openOrReuseBrowserTab(second.tabs, {
    url: "https://example.com/b",
    title: "Policy",
  });

  assert.equal(first.tabs.length, 1);
  assert.equal(second.tabs.length, 1);
  assert.equal(second.activeId, first.activeId);
  assert.equal(third.tabs.length, 2);

  const afterOne = closeBrowserTab(third.tabs, third.activeId, third.activeId);
  assert.equal(afterOne.tabs.length, 1);
  const afterLast = closeBrowserTab(afterOne.tabs, afterOne.activeId ?? "", afterOne.activeId);
  assert.deepEqual(afterLast.tabs, []);
  assert.equal(afterLast.activeId, null);
});

test("panel resize clamps to min/max and protects the centre width", () => {
  assert.equal(shouldUseOverlay(1100), true);
  assert.equal(shouldUseOverlay(1400), false);
  assert.equal(
    clampLeftWidth({ proposed: 100, rightWidth: 360, viewportWidth: 1600 }),
    LEFT_PANEL_MIN,
  );
  assert.equal(
    clampLeftWidth({ proposed: 900, rightWidth: 360, viewportWidth: 1600 }),
    LEFT_PANEL_MAX,
  );
  assert.equal(
    clampRightWidth({ proposed: 900, leftWidth: 260, viewportWidth: 1600 }),
    RIGHT_PANEL_MAX,
  );
  assert.equal(
    clampRightWidth({ proposed: 200, leftWidth: 260, viewportWidth: 1600 }),
    RIGHT_PANEL_MIN,
  );
  const protectedLeft = clampLeftWidth({
    proposed: 360,
    rightWidth: 520,
    viewportWidth: 1400,
  });
  assert.equal(protectedLeft <= 1400 - 520 - 640 - 16, true);
  assert.equal(rightPanelDensity(360), "compact");
  assert.equal(rightPanelDensity(420), "roomy");
});

test("plaintext orientation does not keep the old organised preface", () => {
  const body = projectOrientation(
    organiseStubSituation({ description: DEPOSIT_DESCRIPTION }),
    DEPOSIT_DESCRIPTION,
  );

  assert.equal(body.includes("What's happening"), true);
  assert.equal(body.includes("Sensible next steps"), true);
  assert.equal(body.includes("What you shouldn't do"), true);
  assert.equal(body.includes("Current obstacle"), true);
  assert.equal(body.includes("What matters"), false);
  assert.equal(body.includes("Still uncertain"), false);
  assert.equal(body.includes("I have organised what you have shared so far."), false);
  assert.equal(body.includes("When did this happen?"), false);
});

test("centre result hides still-uncertain lists and duplicate executable actions", () => {
  const deposit = projectScenario(DEPOSIT_DESCRIPTION).model;
  const refund = projectScenario(REFUND_DESCRIPTION).model;
  const employment = projectScenario(EMPLOYMENT_DESCRIPTION).model;
  const card = readFileSync(join(directory, "OrientationCard.tsx"), "utf8");
  const detailsPanel = readFileSync(join(directory, "DetailsPanel.tsx"), "utf8");

  for (const model of [deposit, refund, employment]) {
    const body = formatOrientationBody(model);
    const stepLabels = model.nextSteps
      .map((step) => step.action?.label)
      .filter((label): label is string => typeof label === "string");

    assert.equal(body.includes("Still uncertain"), false);
    assert.equal(body.includes("Aram can help you next"), false);
    assert.deepEqual(model.stillUnclear, []);
    assert.equal(model.helpNext.length, 0);
    assert.equal(
      model.helpNext.some((item) => stepLabels.includes(item.label)),
      false,
    );
    assert.equal(model.standing.inYourFavour.length > 0, true);
    assert.equal(typeof model.standing.currentObstacle, "string");
  }

  assert.equal(refund.standing.currentAssumption !== null, true);
  assert.equal(deposit.standing.currentAssumption, null);
  assert.equal(employment.standing.currentAssumption, null);
  assert.equal(card.includes("Still uncertain"), false);
  assert.equal(card.includes("uppercase"), false);
  assert.equal(card.includes("In your favour"), true);
  assert.equal(card.includes("Current obstacle"), true);
  assert.equal(card.includes("current assumption"), true);
  assert.equal(detailsPanel.includes("What still matters"), false);
});

test("next-step CTAs sit below copy, are not duplicated, and recommend one unresolved action", () => {
  const deposit = projectScenario(DEPOSIT_DESCRIPTION).model;
  const refund = projectScenario(REFUND_DESCRIPTION).model;
  const employment = projectScenario(EMPLOYMENT_DESCRIPTION).model;
  const writtenRefund = projectScenario(
    `${REFUND_DESCRIPTION} I already put the refund request in writing.`,
  ).model;
  const card = readFileSync(join(directory, "OrientationCard.tsx"), "utf8");

  assert.equal(card.includes("sm:flex-row sm:items-start sm:justify-between"), false);
  assert.equal(card.includes("contextualStepAction"), true);
  assert.equal(card.includes("{step.why}"), true);
  assert.equal(card.includes("{stepAction.label} →"), true);
  assert.equal(card.includes("Recommended next action"), true);

  assert.equal(deposit.recommendedNextAction?.stepId, "deposit-reason");
  assert.equal(deposit.recommendedNextAction?.action?.label, "Draft request");
  assert.equal(refund.recommendedNextAction?.stepId, "refund-status");
  assert.equal(refund.recommendedNextAction?.action?.label, "Draft refund request");
  assert.equal(employment.recommendedNextAction?.stepId, "salary-deduction");
  assert.equal(writtenRefund.recommendedNextAction?.stepId, "return-inspection");
  assert.equal(writtenRefund.recommendedNextAction?.action?.label, "Prepare follow-up");

  for (const model of [deposit, refund, employment, writtenRefund]) {
    const labels = visibleCtaLabels(model);
    assert.equal(new Set(labels).size, labels.length);
    assert.equal(model.helpNext.length, 0);
    assert.equal(
      FUTURE_CONVERSATION_ACTION_LABELS.some((label) => labels.includes(label)),
      false,
    );
    assert.equal(
      model.nextSteps.some((step) => step.action?.kind === "open-verified-source"),
      false,
    );
    assert.equal(
      model.nextSteps.some((step) => step.id === "later-formal-route" && step.action === null),
      true,
    );
    const body = formatOrientationBody(model);
    assert.equal(body.includes("Recommended next action"), true);
    if (model.recommendedNextAction?.action) {
      const label = model.recommendedNextAction.action.label;
      const occurrences = body.split(label).length - 1;
      assert.equal(occurrences, 1);
    }
  }

  assert.equal(
    selectRecommendedNextAction(refund.nextSteps, REFUND_DESCRIPTION)?.stepId,
    "refund-status",
  );
  assert.equal(
    selectRecommendedNextAction(
      writtenRefund.nextSteps,
      `${REFUND_DESCRIPTION} I already put the refund request in writing.`,
    )?.stepId,
    "return-inspection",
  );
});

function visibleCtaLabels(model: ReturnType<typeof projectOrientationModel>): string[] {
  const recommendedId = model.recommendedNextAction?.stepId ?? null;
  const labels: string[] = [];

  for (const step of model.nextSteps) {
    if (step.action === null || step.id === recommendedId) {
      continue;
    }

    labels.push(step.action.label);
  }

  if (model.recommendedNextAction?.action) {
    labels.push(model.recommendedNextAction.action.label);
  }

  return labels;
}

test("desktop chat columns scroll independently below the header", () => {
  const shell = readFileSync(join(directory, "ChatShell.tsx"), "utf8");
  const sidebar = readFileSync(join(directory, "ConversationSidebar.tsx"), "utf8");
  const workspace = readFileSync(join(directory, "ConversationWorkspace.tsx"), "utf8");
  const chat = readFileSync(join(directory, "ConversationChat.tsx"), "utf8");
  const thread = readFileSync(join(directory, "ChatThread.tsx"), "utf8");
  const situation = readFileSync(join(directory, "SituationWorkspace.tsx"), "utf8");
  const layout = readFileSync(join(directory, "../../app/layout.tsx"), "utf8");
  const chatLayout = readFileSync(join(directory, "../../app/chat/layout.tsx"), "utf8");
  const footer = readFileSync(
    join(directory, "../../components/SiteFooter.tsx"),
    "utf8",
  );

  assert.equal(layout.includes("h-dvh"), true);
  assert.equal(layout.includes("overflow-hidden"), true);
  assert.equal(chatLayout.includes("overflow-hidden"), true);
  assert.equal(shell.includes("min-h-[calc(100dvh-8.5rem)]"), false);
  assert.equal(shell.includes("overflow-hidden"), true);
  assert.equal(sidebar.includes("overflow-y-auto"), true);
  assert.equal(sidebar.includes("New chat"), true);
  assert.equal(sidebar.includes("Archived"), true);
  assert.equal(workspace.includes("overflow-hidden"), true);
  assert.equal(workspace.includes("shrink-0"), true);
  assert.equal(chat.includes("overflow-hidden"), true);
  assert.equal(chat.includes("overflow-y-auto"), false);
  assert.equal(chat.includes("shrink-0"), true);
  assert.equal(thread.includes('id="conversation-transcript"'), true);
  assert.equal(thread.includes("overflow-y-auto"), true);
  assert.equal((thread.match(/overflow-y-auto/g) ?? []).length, 1);
  assert.equal((thread.match(/<article[^>]*overflow-y/g) ?? []).length, 0);
  assert.equal(thread.includes("max-w-2xl overflow-x-hidden"), false);
  assert.equal(thread.includes("transcriptScrollTop"), true);
  assert.equal(thread.includes("ResizeObserver"), true);
  assert.equal(thread.includes("[overflow-anchor:none]"), true);
  assert.equal(thread.includes("min-h-0"), true);
  assert.equal(situation.includes("overflow-y-auto"), true);
  assert.equal(situation.includes("BrowserWorkspace"), true);
  assert.equal(footer.includes('pathname.startsWith("/chat")'), true);
});
