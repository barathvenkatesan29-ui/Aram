const HOUSING_DEPOSIT_PATTERN =
  /\b(landlord|landlady|security deposit|rental deposit)\b/i;
const MARKETPLACE_PATTERN = /\b(marketplace|bought online)\b/i;
const AMOUNT_PATTERN =
  /₹\s?[\d,]+(?:\.\d+)?|\bRs\.?\s*[\d,]+(?:\.\d+)?|\bINR\s*[\d,]+/i;

const EVIDENCE_CATALOG: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\binvoice\b/i, label: "Invoice" },
  { pattern: /\breturn approval\b/i, label: "Return approval" },
  { pattern: /\bpickup confirmation\b/i, label: "Pickup confirmation" },
  {
    pattern:
      /\bphotos? of (?:the )?(?:damage|damaged screen|damaged product)\b|\bdamage photos?\b/i,
    label: "Photos of damaged screen/product",
  },
  {
    pattern: /\bsupport(?: conversation)? screenshots?\b/i,
    label: "Support conversation screenshots",
  },
  {
    pattern: /\bproof(?: that I paid| of (?:payment|the deposit))?\b|\breceipt\b/i,
    label: "Proof of payment",
  },
  {
    pattern: /\bmessages where .{0,80}refund\b/i,
    label: "Messages requesting the refund",
  },
  { pattern: /\bagreement\b/i, label: "Agreement" },
  { pattern: /\bhandover (?:communication|proof|photos?)?\b/i, label: "Handover communication" },
  { pattern: /\boffer letter\b/i, label: "Offer letter" },
  { pattern: /\bpayslips?\b|\bsalary slips?\b/i, label: "Payslips" },
  { pattern: /\bbank statements?\b/i, label: "Bank statement" },
];

const EVIDENCE_FALLBACKS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bscreenshots?\b/i, label: "Screenshots" },
  { pattern: /\bphotos?\b/i, label: "Photos" },
];

export function isHousingDepositDescription(description: string): boolean {
  return (
    HOUSING_DEPOSIT_PATTERN.test(description) &&
    !MARKETPLACE_PATTERN.test(description)
  );
}

export function isEmploymentDeductionDescription(description: string): boolean {
  return (
    /\b(employer|employment|salary|wage|payslip|hr)\b/i.test(description) &&
    /\b(deduct|deduction|cut from)\b/i.test(description) &&
    !isHousingDepositDescription(description) &&
    !MARKETPLACE_PATTERN.test(description)
  );
}

export function extractEvidenceItems(description: string): string[] {
  const items: string[] = [];

  for (const candidate of EVIDENCE_CATALOG) {
    if (candidate.pattern.test(description)) {
      items.push(candidate.label);
    }
  }

  for (const fallback of EVIDENCE_FALLBACKS) {
    if (
      fallback.pattern.test(description) &&
      !items.some((item) => item.toLowerCase().includes(fallback.label.toLowerCase()))
    ) {
      items.push(fallback.label);
    }
  }

  return uniqueTexts(items);
}

export function extractMatterPoints(description: string): string[] {
  const points: string[] = [];
  const amount = firstMatch(description, AMOUNT_PATTERN);
  const housingDeposit = isHousingDepositDescription(description);
  const evidence = extractEvidenceItems(description);

  if (
    /\b(arrived with a damaged|arrived damaged|damaged screen|damaged product)\b/i.test(
      description,
    )
  ) {
    points.push("Product arrived damaged.");
  }

  if (/\breturn approval\b|\breturn (was )?approved\b/i.test(description)) {
    points.push("Return was approved.");
  }

  if (
    /\bpickup (was )?(completed|done)\b|\bpicked up\b|\bpickup confirmation\b/i.test(
      description,
    )
  ) {
    points.push("Pickup has already happened.");
  }

  if (/\brefund is still under review\b|\bstill under review\b/i.test(description)) {
    points.push("Refund is still under review.");
  }

  if (
    /\bwaiting for the marketplace\b|\bseller says[\s\S]{0,120}marketplace\b/i.test(
      description,
    )
  ) {
    points.push(
      "Seller and marketplace are pointing responsibility at each other.",
    );
  }

  if (amount !== null && /\b(security )?deposit\b/i.test(description) && housingDeposit) {
    points.push(`A ${amount.replace(/\s+/g, " ")} security deposit is involved.`);
  } else if (amount !== null && !housingDeposit) {
    points.push(`${amount.replace(/\s+/g, " ")} is involved.`);
  }

  if (/\bhanded over\b/i.test(description) && /\bno major damage\b/i.test(description)) {
    points.push("The property was handed back without major damage.");
  }

  if (
    /\balready asked for the (deposit|refund|money)\b|\balready asked for the deposit back\b/i.test(
      description,
    )
  ) {
    points.push("A refund has already been requested.");
  }

  if (
    housingDeposit &&
    /\b(keeps delaying|not clearly explained why the money is being withheld)\b/i.test(
      description,
    )
  ) {
    points.push(
      "The landlord has not clearly explained why the deposit is being withheld.",
    );
  }

  if (evidence.length > 0) {
    points.push("You have supporting records.");
  }

  return uniqueTexts(points).slice(0, 6);
}

export type NextStepAction =
  | { kind: "view-evidence"; label: string }
  | { kind: "show-draft"; label: string; draftId: string }
  | { kind: "open-verified-source"; label: string; url: string; title: string };

export type ActionableNextStep = {
  id: string;
  text: string;
  why: string;
  action: NextStepAction | null;
};

export type StandingModel = {
  inYourFavour: string[];
  currentObstacle: string | null;
  currentAssumption: string | null;
};

export function extractStanding(description: string): StandingModel {
  return {
    inYourFavour: extractFavourableFacts(description),
    currentObstacle: extractCurrentObstacle(description),
    currentAssumption: extractCurrentAssumption(description),
  };
}

function extractFavourableFacts(description: string): string[] {
  const points: string[] = [];
  const amount = firstMatch(description, AMOUNT_PATTERN);
  const housingDeposit = isHousingDepositDescription(description);
  const employment = isEmploymentDeductionDescription(description);
  const evidence = extractEvidenceItems(description);

  if (
    /\b(arrived with a damaged|arrived damaged|damaged screen|damaged product)\b/i.test(
      description,
    )
  ) {
    points.push("The product arrived damaged.");
  }

  if (/\breturn approval\b|\breturn (was )?approved\b/i.test(description)) {
    points.push("The return was approved.");
  }

  if (
    /\bpickup (was )?(completed|done)\b|\bpicked up\b|\bpickup confirmation\b/i.test(
      description,
    )
  ) {
    points.push("Pickup has already happened.");
  }

  if (amount !== null && housingDeposit) {
    points.push(`You paid a ${amount.replace(/\s+/g, " ")} security deposit.`);
  }

  if (/\bhanded over\b/i.test(description) && /\bno major damage\b/i.test(description)) {
    points.push("The property was handed back without major damage.");
  }

  if (
    housingDeposit &&
    /\balready asked for the (deposit|refund|money)\b|\balready asked for the deposit back\b/i.test(
      description,
    )
  ) {
    points.push("You have already asked for the deposit back.");
  }

  if (employment && amount !== null) {
    points.push(`A ${amount.replace(/\s+/g, " ")} salary deduction is recorded.`);
  }

  if (evidence.length > 0) {
    points.push(
      `Records already identified: ${joinAnd(evidence.map(preservePhrase))}.`,
    );
  }

  return uniqueTexts(points).slice(0, 5);
}

export function interpretWhatsHappening(description: string): string | null {
  const points = extractMatterPoints(description).filter(
    (point) => !/supporting records/i.test(point),
  );

  if (points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    return points[0] ?? null;
  }

  const head = (points[0] ?? "").replace(/\.$/, "");
  const rest = points.slice(1).map((point) => unsentence(point));
  const restJoined = joinAnd(rest);
  const restSentence = `${restJoined.charAt(0).toUpperCase()}${restJoined.slice(1)}`;

  return `${head}. ${restSentence}.`;
}

export function extractNextSteps(description: string): ActionableNextStep[] {
  const steps: ActionableNextStep[] = [];
  const housingDeposit = isHousingDepositDescription(description);
  const employment = isEmploymentDeductionDescription(description);

  if (
    housingDeposit &&
    /\b(withheld|withholding|not returned|keeps delaying|deposit)\b/i.test(description)
  ) {
    steps.push({
      id: "deposit-reason",
      text: "Put a written request for the deposit return.",
      why: "A dated request records what you are asking for after informal follow-ups have not resolved it.",
      action: {
        kind: "show-draft",
        label: "Draft request",
        draftId: "deposit-reason",
      },
    });
  }

  if (
    housingDeposit &&
    (/\b(damage|deduction)\b/i.test(description) ||
      !/\b(itemised|itemized)\b/i.test(description))
  ) {
    steps.push({
      id: "deposit-itemised",
      text: "Get an itemised list of any claimed deductions in writing.",
      why: "An itemised list shows whether any deduction is actually being claimed, and for what.",
      action: {
        kind: "show-draft",
        label: "Draft itemised request",
        draftId: "deposit-itemised",
      },
    });
  }

  if (employment) {
    steps.push({
      id: "salary-deduction",
      text: "Get an itemised written breakdown of the salary deduction.",
      why: "A breakdown shows what was taken and whether it matches what you were told.",
      action: {
        kind: "show-draft",
        label: "Draft request",
        draftId: "salary-deduction",
      },
    });
  }

  if (
    !housingDeposit &&
    !employment &&
    /\brefund\b/i.test(description) &&
    (/\bunder review\b/i.test(description) ||
      !/\b(reference (number|no\.?|id)|refund id)\b/i.test(description))
  ) {
    steps.push({
      id: "refund-status",
      text: "Put your refund demand in writing.",
      why: "A dated written request records what you are asking for and who should answer.",
      action: {
        kind: "show-draft",
        label: "Draft refund request",
        draftId: "refund-status",
      },
    });
  }

  if (
    !housingDeposit &&
    !employment &&
    (/\bpickup\b/i.test(description) ||
      /\breturn approval\b/i.test(description) ||
      /\breturned? (?:a |the )?(?:laptop|item|product|phone|order)\b/i.test(
        description,
      )) &&
    !/\b(inspection (?:accepted|cleared|completed)|cleared inspection)\b/i.test(
      description,
    )
  ) {
    steps.push({
      id: "return-inspection",
      text: "Confirm whether return inspection is complete.",
      why: "The refund may still be waiting on inspection even though pickup is done.",
      action: {
        kind: "show-draft",
        label: "Prepare follow-up",
        draftId: "return-inspection",
      },
    });
  }

  if (
    !housingDeposit &&
    !employment &&
    /\b(marketplace|seller|support)\b/i.test(description) &&
    /\b(different answers|inconsistent|keeps giving)\b/i.test(description)
  ) {
    steps.push({
      id: "marketplace-escalate",
      text: "Escalate through the marketplace's official support or escalation route.",
      why: "Frontline answers have not been consistent, so the official route is the next recorded step.",
      action: null,
    });
  }

  if (housingDeposit && steps.length > 0) {
    steps.push({
      id: "later-formal-route",
      text: "If a written request still does not resolve this, a later formal complaint or notice may become relevant.",
      why: "Aram cannot yet open a verified filing route, so this stays a possible later step rather than an action Aram can take now.",
      action: null,
    });
  }

  if (employment && steps.length > 0) {
    steps.push({
      id: "later-formal-route",
      text: "If HR does not provide a breakdown, a later internal grievance or formal complaint may become relevant.",
      why: "Aram cannot yet open a verified grievance or filing route, so this stays a possible later step rather than an action Aram can take now.",
      action: null,
    });
  }

  if (
    !housingDeposit &&
    !employment &&
    steps.some((step) => step.id === "marketplace-escalate")
  ) {
    steps.push({
      id: "later-formal-route",
      text: "If the marketplace route does not resolve this, a later official complaint route may become relevant.",
      why: "Aram cannot yet verify an official portal for this situation, so this stays a possible later step without a button.",
      action: null,
    });
  }

  return uniqueSteps(steps).slice(0, 5);
}

export function isNextStepResolved(
  step: ActionableNextStep,
  description: string,
): boolean {
  switch (step.id) {
    case "refund-status":
      return /\b(written refund (demand|request)|put (the |my )?refund (demand|request) in writing)\b/i.test(
        description,
      );
    case "return-inspection":
      return /\b(inspection (?:accepted|cleared|completed)|cleared inspection)\b/i.test(
        description,
      );
    case "deposit-reason":
      return /\b(written (request|letter|email).{0,80}deposit|deposit.{0,80}written (request|letter|email))\b/i.test(
        description,
      );
    case "deposit-itemised":
      return /\b(itemised|itemized) (list|breakdown) .{0,40}(received|got|sent)\b/i.test(
        description,
      );
    case "salary-deduction":
      return (
        /\b(itemised|itemized) (written )?breakdown\b/i.test(description) &&
        /\b(received|got|sent me)\b/i.test(description)
      );
    default:
      return false;
  }
}

export function extractAvoidActions(description: string): string[] {
  const items: string[] = [];
  const evidence = extractEvidenceItems(description);
  const housingDeposit = isHousingDepositDescription(description);
  const employment = isEmploymentDeductionDescription(description);
  const marketplace =
    !housingDeposit &&
    !employment &&
    /\b(refund|marketplace|seller|support)\b/i.test(description);

  if (evidence.length > 0) {
    if (housingDeposit) {
      items.push(
        "Do not delete the deposit payment proof or the messages asking for it back.",
      );
    } else if (employment) {
      items.push(
        "Do not delete the offer letter, payslips, or bank statement showing the deduction.",
      );
    } else {
      items.push("Do not delete the supporting records you already have.");
    }
  }

  if (housingDeposit) {
    items.push(
      "Do not rely only on verbal updates from the landlord when you can get the position in writing.",
    );
    items.push(
      "Do not share OTPs, passwords, or extra sensitive details to chase the deposit.",
    );
    items.push(
      "Do not make threats or claims you cannot back with the records you have.",
    );
  } else if (employment) {
    items.push(
      "Do not rely only on verbal explanations from HR when you can get the deduction in writing.",
    );
    items.push(
      "Do not share OTPs, passwords, or extra payroll credentials to chase this.",
    );
    items.push(
      "Do not make allegations about the employer that you cannot back with the records you have.",
    );
  } else if (marketplace) {
    items.push(
      "Do not rely only on verbal or chat updates from support when you can get the position in writing.",
    );
    items.push(
      "Do not share OTPs, passwords, or extra sensitive details to chase the refund.",
    );
    items.push(
      "Do not make threats or claims you cannot back with the records you have.",
    );
  }

  return uniqueTexts(items).slice(0, 4);
}

export function draftCopyFor(draftId: string): string | null {
  switch (draftId) {
    case "refund-status":
      return [
        "Please confirm in writing:",
        "1. The current status of my refund.",
        "2. Whether a refund or reference number exists.",
        "3. Who currently owns the refund process.",
        "",
        "Return pickup is already completed. I can share the invoice, return approval, pickup confirmation, and related records if needed.",
      ].join("\n");
    case "return-inspection":
      return [
        "Please confirm in writing whether the returned item has completed inspection and whether that inspection was accepted.",
        "If inspection is complete, please say what happens next for the refund.",
      ].join("\n");
    case "deposit-reason":
      return [
        "Please confirm in writing why my security deposit has not been returned.",
        "Include any amount still held and the reason for holding it.",
      ].join("\n");
    case "deposit-itemised":
      return "Please send an itemised written list of any deductions being claimed against the deposit.";
    case "salary-deduction":
      return [
        "Please confirm in writing why this amount was deducted from my salary.",
        "Send an itemised breakdown of the deduction and say whether it was authorised.",
      ].join("\n");
    default:
      return null;
  }
}

export function extractCurrentObstacle(description: string): string | null {
  const housingDeposit = isHousingDepositDescription(description);
  const employment = isEmploymentDeductionDescription(description);

  if (housingDeposit) {
    if (
      /\bkeeps delaying\b|\bnot clearly explained\b|\bnot returned\b|\bwithheld\b/i.test(
        description,
      )
    ) {
      return "The landlord has not returned the deposit and has not clearly explained why it is still held.";
    }
  }

  if (employment) {
    if (
      /\bwithout a written explanation\b|\bhas not shared the breakdown\b/i.test(
        description,
      )
    ) {
      return "HR has not shared a written breakdown of the salary deduction.";
    }

    return "The salary deduction has not been explained in writing.";
  }

  if (
    /\brefund is still under review\b|\bstill under review\b/i.test(description) &&
    /\b(different answers|inconsistent|keeps giving)\b/i.test(description)
  ) {
    return "The refund is still under review after pickup, and support has given different answers.";
  }

  if (/\brefund is still under review\b|\bstill under review\b/i.test(description)) {
    return "The refund is still under review after the return was picked up.";
  }

  return null;
}

export function extractCurrentAssumption(description: string): string | null {
  if (
    isHousingDepositDescription(description) ||
    isEmploymentDeductionDescription(description)
  ) {
    return null;
  }

  if (
    /\b((?:return )?pickup (?:was )?(?:completed|done)|pickup confirmation|picked up)\b/i.test(
      description,
    ) &&
    !/\binspected\b|\baccepted\b|\bcleared inspection\b/i.test(description)
  ) {
    return "The return pickup is being treated as completed.";
  }

  return null;
}

export function extractUncertainties(description: string): string[] {
  const items: string[] = [];
  const housingDeposit = isHousingDepositDescription(description);
  const employment = isEmploymentDeductionDescription(description);

  if (
    housingDeposit &&
    /\b(deposit|withheld|not returned)\b/i.test(description) &&
    !/\b(specific damage|particular damage|itemised|itemized)\b/i.test(description)
  ) {
    items.push(
      "Whether any specific damage or deduction is being claimed is not stated.",
    );
  }

  if (
    employment &&
    !/\b(itemised|itemized|authoris|authoriz)\b/i.test(description)
  ) {
    items.push(
      "Whether the salary deduction was authorised and itemised is not stated.",
    );
  }

  if (
    !housingDeposit &&
    !employment &&
    (/\bpickup\b/i.test(description) ||
      /\breturn approval\b/i.test(description) ||
      /\breturned? (?:a |the )?(?:laptop|item|product|phone|order)\b/i.test(
        description,
      )) &&
    !/\b(inspection|accepted|cleared)\b/i.test(description)
  ) {
    items.push(
      "Whether return inspection has been accepted or completed is not stated.",
    );
  }

  if (
    !housingDeposit &&
    !employment &&
    /\brefund\b/i.test(description) &&
    /\bunder review\b/i.test(description) &&
    !/\b(initiated|processed|credited)\b/i.test(description)
  ) {
    items.push("Whether the refund has actually been initiated is not stated.");
  }

  if (
    !housingDeposit &&
    !employment &&
    /\brefund\b/i.test(description) &&
    !/\b(reference (number|no\.?)|refund id|arn)\b/i.test(description)
  ) {
    items.push("Whether a refund or reference number exists is not stated.");
  }

  if (
    !housingDeposit &&
    !employment &&
    /\bseller\b/i.test(description) &&
    /\bmarketplace\b/i.test(description) &&
    /\b(waiting for the marketplace|different answers|seller says)\b/i.test(
      description,
    )
  ) {
    items.push("Who currently owns the refund process is not stated.");
  }

  return uniqueTexts(items).slice(0, 4);
}

function unsentence(point: string): string {
  const trimmed = point.replace(/\.$/, "");

  if (trimmed.length === 0) {
    return "";
  }

  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function uniqueSteps(steps: ActionableNextStep[]): ActionableNextStep[] {
  const seen = new Set<string>();
  const unique: ActionableNextStep[] = [];

  for (const step of steps) {
    if (seen.has(step.id)) {
      continue;
    }

    seen.add(step.id);
    unique.push(step);
  }

  return unique;
}

function preservePhrase(label: string): string {
  switch (label) {
    case "Photos of damaged screen/product":
      return "damage photos";
    case "Support conversation screenshots":
      return "support records";
    case "Proof of payment":
      return "proof of payment";
    case "Messages requesting the refund":
      return "refund messages";
    case "Agreement":
      return "the agreement";
    case "Handover communication":
      return "handover communication";
    case "Offer letter":
      return "offer letter";
    case "Payslips":
      return "payslips";
    case "Bank statement":
      return "bank statement";
    default:
      return label.toLowerCase();
  }
}

function firstMatch(value: string, pattern: RegExp): string | null {
  return value.match(pattern)?.[0] ?? null;
}

function joinAnd(items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function uniqueTexts(items: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const item of items) {
    const key = item.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}
