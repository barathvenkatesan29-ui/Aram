import assert from "node:assert/strict";
import { test } from "node:test";
import { getSafeNextPath } from "./safeNextPath.ts";

test("safe next path defaults to chat and maps old case routes", () => {
  assert.equal(getSafeNextPath(undefined), "/chat");
  assert.equal(getSafeNextPath("/start"), "/chat");
  assert.equal(getSafeNextPath("/cases"), "/chat");
  assert.equal(
    getSafeNextPath("/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    "/chat/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.equal(
    getSafeNextPath("/chat/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    "/chat/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  assert.equal(getSafeNextPath("/chat/archived"), "/chat/archived");
  assert.equal(getSafeNextPath("/chat/../cases"), "/chat");
});
