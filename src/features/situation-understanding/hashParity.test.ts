import assert from "node:assert/strict";
import { test } from "node:test";
import { toCanonicalAnswers } from "./canonicalAnswers.ts";
import {
  hashCanonicalAnswers,
  hashCaseDescription,
  serializeCanonicalAnswers,
} from "./hashCaseInput.ts";
import type { StoredQuestion } from "../../types/situationUnderstanding.ts";

const JS_TRIM_CODE_POINTS = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000,
  0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
  0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
] as const;

function sqlJsStringTrim(value: string): string {
  const classChars = JS_TRIM_CODE_POINTS.map((codePoint) =>
    String.fromCodePoint(codePoint),
  ).join("");
  const pattern = new RegExp(`^[${classChars}]+|[${classChars}]+$`, "g");
  return value.replace(pattern, "");
}

const DESCRIPTION_SAMPLES: ReadonlyArray<{ label: string; input: string }> = [
  { label: "normal text", input: "The landlord kept the deposit." },
  { label: "leading/trailing spaces", input: "  The landlord kept the deposit.  " },
  {
    label: "leading/trailing newline",
    input: "\nThe landlord kept the deposit.\n",
  },
  { label: "leading/trailing tab", input: "\tThe landlord kept the deposit.\t" },
  { label: "Tamil", input: "வணக்கம். வீட்டு வாடகை முன்பணம்." },
  { label: "rupee", input: "The landlord kept the ₹40,000 deposit." },
];

test("js_string_trim code points match String.prototype.trim", () => {
  for (const codePoint of JS_TRIM_CODE_POINTS) {
    const wrapped = `${String.fromCodePoint(codePoint)}x${String.fromCodePoint(codePoint)}`;
    assert.equal(wrapped.trim(), "x");
    assert.equal(sqlJsStringTrim(wrapped), wrapped.trim());
  }

  assert.equal("y".trim(), sqlJsStringTrim("y"));
});

test("hashCaseDescription matches SHA-256 of SQL js_string_trim under persisted-description samples", () => {
  const sqlHashesVerifiedOnLinkedPostgres: Record<string, string> = {
    "normal text":
      "30e37ddf858fd724408eb1ba639673faac9334437078045e53c4d0b0f016cecf",
    "leading/trailing spaces":
      "30e37ddf858fd724408eb1ba639673faac9334437078045e53c4d0b0f016cecf",
    "leading/trailing newline":
      "30e37ddf858fd724408eb1ba639673faac9334437078045e53c4d0b0f016cecf",
    "leading/trailing tab":
      "30e37ddf858fd724408eb1ba639673faac9334437078045e53c4d0b0f016cecf",
    Tamil: "5670c114578a551dee4843270da9ed3898879934bc7dc7c493807a42db4da5e2",
    rupee: "b23a0dc5bffb21a9e3d9b8b35f8215d3eaced5d6fcf798cd8faad2f8bf011a28",
  };

  for (const sample of DESCRIPTION_SAMPLES) {
    assert.equal(sqlJsStringTrim(sample.input), sample.input.trim());
    assert.equal(hashCaseDescription(sample.input), hashCaseDescription(sample.input.trim()));
    assert.equal(
      hashCaseDescription(sample.input),
      sqlHashesVerifiedOnLinkedPostgres[sample.label],
    );
  }
});

test("canonical answers serialization matches compact JSON.stringify used by SQL concat/to_json", () => {
  const questions: StoredQuestion[] = [
    {
      id: "77777777-7777-4777-8777-777777777777",
      position: 1,
      question: "What is the exact building address?",
      why_it_matters: "An address can be useful later.",
      status: "skipped",
      answer: null,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      position: 2,
      question: "Was the deposit meant to be returned when you moved out?",
      why_it_matters:
        "Whether return was expected can change what this situation appears to be.",
      status: "answered",
      answer: "  Yes, it was to be returned.\n",
    },
  ];

  const canonical = toCanonicalAnswers(questions);
  assert.notEqual(canonical, null);
  const serialized = serializeCanonicalAnswers(canonical ?? []);

  assert.equal(
    serialized,
    '[{"id":"77777777-7777-4777-8777-777777777777","position":1,"status":"skipped","answer":""},{"id":"88888888-8888-4888-8888-888888888888","position":2,"status":"answered","answer":"Yes, it was to be returned."}]',
  );
  assert.equal(
    hashCanonicalAnswers(canonical ?? []),
    "37a8ee7050cef84fe51e42947d01a5db2328b1156dea13bcea1a68f65520a9f3",
  );
  assert.equal(canonical?.[1]?.answer, questions[1]?.answer?.trim());
});
