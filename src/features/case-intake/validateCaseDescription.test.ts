import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_CASE_DESCRIPTION_LENGTH,
  MIN_CASE_DESCRIPTION_LENGTH,
  validateCaseDescription,
} from "./validateCaseDescription.ts";

test("case descriptions accept 1 to 8000 characters after trim", () => {
  assert.equal(MIN_CASE_DESCRIPTION_LENGTH, 1);
  assert.equal(MAX_CASE_DESCRIPTION_LENGTH, 8000);
  assert.equal(validateCaseDescription("H").ok, true);
  assert.equal(validateCaseDescription(" ").ok, false);
  assert.equal(validateCaseDescription("a".repeat(8000)).ok, true);
  assert.equal(validateCaseDescription("a".repeat(8001)).ok, false);
});
