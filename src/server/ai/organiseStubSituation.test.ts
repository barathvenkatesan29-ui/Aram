import assert from "node:assert/strict";
import { test } from "node:test";
import { organiseStubSituation } from "./organiseStubSituation.ts";
import { validateSituationUnderstanding } from "../../features/situation-understanding/validateSituationUnderstanding.ts";
import { decideOptionalClarification } from "../../features/situation-understanding/decideOptionalClarification.ts";

const DEPOSIT_DESCRIPTION =
  "My landlord has not returned my ₹40,000 security deposit after I moved out. I handed over the house and there was no major damage. I have already asked for the deposit back, but the landlord keeps delaying and has not clearly explained why the money is being withheld. I have proof that I paid the deposit and messages where I asked for the refund. I want to understand what my situation is and what I can reasonably do next.";

const REFUND_DESCRIPTION =
  "I returned a laptop I bought online because it arrived with a damaged screen. The return pickup was completed, but the marketplace says the refund is still under review. The seller says they are waiting for the marketplace, and support keeps giving me different answers. I have the invoice, return approval, pickup confirmation, photos of the damage, and support screenshots.";

test("stub organiser restates the deposit situation without questions or legal claims", () => {
  const organised = organiseStubSituation({ description: DEPOSIT_DESCRIPTION });
  const result = validateSituationUnderstanding(organised, {
    round: "initial",
    description: DEPOSIT_DESCRIPTION,
    answers: [],
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.understanding.questions.length, 0);
  assert.equal(decideOptionalClarification(result.understanding.questions).kind, "zero");
  assert.equal(result.understanding.userFacts.length >= 3, true);
  assert.equal(
    result.understanding.userFacts.some((fact) => fact.text.includes("₹40,000")),
    true,
  );
  assert.equal(
    result.understanding.userFacts.some((fact) => /proof/i.test(fact.text)),
    true,
  );
  assert.equal(
    result.understanding.parties.some((party) => party.label === "landlord"),
    true,
  );
  assert.equal(
    result.understanding.situationThemes.some((theme) => /deposit/i.test(theme.text)),
    true,
  );
  assert.equal(
    /\b(liable|statute|section\s*\d+|your rights|file a case|offence)\b/i.test(
      JSON.stringify(result.understanding),
    ),
    false,
  );
  assert.equal(
    result.understanding.questions.some((question) =>
      /when did this happen/i.test(question.question),
    ),
    false,
  );
});

test("stub organiser stays at zero questions on follow-up", () => {
  const organised = organiseStubSituation({
    description: DEPOSIT_DESCRIPTION,
    answers: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        position: 1,
        status: "answered",
        answer: "The landlord still has not given any written reason.",
      },
    ],
  });
  const result = validateSituationUnderstanding(organised, {
    round: "follow_up",
    description: DEPOSIT_DESCRIPTION,
    answers: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        position: 1,
        status: "answered",
        answer: "The landlord still has not given any written reason.",
      },
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.understanding.questions.length, 0);
    assert.equal(
      result.understanding.userFacts.some((fact) => fact.source_kind === "answer"),
      true,
    );
  }
});

test("stub organiser restates a marketplace refund without landlord-deposit copy", () => {
  const organised = organiseStubSituation({ description: REFUND_DESCRIPTION });
  const result = validateSituationUnderstanding(organised, {
    round: "initial",
    description: REFUND_DESCRIPTION,
    answers: [],
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.understanding.questions.length, 0);
  assert.equal(decideOptionalClarification(result.understanding.questions).kind, "zero");
  assert.equal(
    result.understanding.userFacts.some((fact) => /damaged screen/i.test(fact.text)),
    true,
  );
  assert.equal(
    result.understanding.parties.some((party) => party.label === "marketplace"),
    true,
  );
  assert.equal(
    result.understanding.parties.some((party) => party.label === "seller"),
    true,
  );
  assert.equal(
    result.understanding.parties.some((party) => party.label === "landlord"),
    false,
  );
  assert.equal(
    result.understanding.situationThemes.some((theme) => /security deposit/i.test(theme.text)),
    false,
  );
  assert.equal(
    result.understanding.uncertainties.some((item) =>
      /damage or deduction|deduction is being claimed/i.test(item.text),
    ),
    false,
  );
  assert.equal(
    result.understanding.uncertainties.some((item) => /inspection|reference number|owns the refund/i.test(item.text)),
    true,
  );
});
