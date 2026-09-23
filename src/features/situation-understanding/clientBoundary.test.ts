import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));

function readFeature(fileName: string): string {
  return readFileSync(join(directory, fileName), "utf8");
}

test("client components do not import src/server/ai", () => {
  const form = readFeature("UnderstandCaseForm.tsx");
  const brief = readFeature("SituationBrief.tsx");

  assert.equal(form.includes("server/ai"), false);
  assert.equal(brief.includes("server/ai"), false);
  assert.equal(form.includes("getProvider"), false);
  assert.equal(brief.includes("getProvider"), false);
});

test("understandCase and page modules do not introduce a numeric version", () => {
  const action = readFeature("actions.ts");
  const latestAnalysis = readFeature("getLatestAnalysis.ts");
  const selector = readFeature("selectAnalysisState.ts");
  const page = readFileSync(
    join(directory, "../../app/cases/[id]/page.tsx"),
    "utf8",
  );

  assert.equal(/\bversion\b/.test(action), false);
  assert.equal(/\bversion\b/.test(latestAnalysis), false);
  assert.equal(/\bversion\b/.test(selector), false);
  assert.equal(/\bversion\b/.test(page), false);
});
