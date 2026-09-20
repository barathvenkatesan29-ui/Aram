import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveProvider } from "./getProvider.ts";
import { stubProvider } from "./stubProvider.ts";
import { validateSituationUnderstanding } from "../../features/situation-understanding/validateSituationUnderstanding.ts";

test("getProvider returns unavailable, not stub, when env is unset", () => {
  const result = resolveProvider({
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failureCode, "unavailable");
  }
});

test("getProvider allows stub only in local development", () => {
  const result = resolveProvider({
    SITUATION_UNDERSTANDING_ALLOW_STUB: "true",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.provider.id, "stub");
  }
});

test("getProvider does not fall back to stub on a non-local site URL", () => {
  const result = resolveProvider({
    SITUATION_UNDERSTANDING_ALLOW_STUB: "true",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failureCode, "unavailable");
  }
});

test("getProvider does not use stub when live is requested without a live adapter", () => {
  const result = resolveProvider({
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://example.com",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failureCode, "unavailable");
  }
});

test("stub output passes the understanding validator", async () => {
  const description =
    "The landlord kept the rental deposit after I moved out of the flat in Pune in March.";
  const output = await stubProvider.understand({
    round: "initial",
    description,
    answers: [],
  });
  const result = validateSituationUnderstanding(output, {
    round: "initial",
    description,
    answers: [],
  });

  assert.equal(result.ok, true);
});
