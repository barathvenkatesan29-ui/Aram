import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_CONVERSATION_TITLE_LENGTH,
  MIN_CONVERSATION_TITLE_LENGTH,
  selectActiveConversations,
  selectArchivedConversations,
  validateConversationTitle,
} from "./conversationManagement.ts";

const directory = dirname(fileURLToPath(import.meta.url));

test("rename accepts a trimmed 1-80 character title and nothing else", () => {
  assert.equal(MIN_CONVERSATION_TITLE_LENGTH, 1);
  assert.equal(MAX_CONVERSATION_TITLE_LENGTH, 80);
  assert.deepEqual(validateConversationTitle("  Deposit dispute  "), {
    ok: true,
    title: "Deposit dispute",
  });
  assert.equal(validateConversationTitle(" ").ok, false);
  assert.equal(validateConversationTitle("a".repeat(81)).ok, false);
});

test("archive hides from normal history and unarchive restores it", () => {
  const conversations = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      archived_at: null,
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      archived_at: "2026-09-21T08:00:00.000Z",
    },
  ];

  assert.deepEqual(
    selectActiveConversations(conversations).map((item) => item.id),
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  );
  assert.deepEqual(
    selectArchivedConversations(conversations).map((item) => item.id),
    ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  );
  assert.deepEqual(
    selectActiveConversations([
      { id: conversations[1]!.id, archived_at: null },
    ]).map((item) => item.id),
    [conversations[1]!.id],
  );
});

test("rename updates title only and archive does not mutate intelligence fields", () => {
  const actions = readFileSync(join(directory, "actions.ts"), "utf8");
  const renameStart = actions.indexOf("export async function renameConversation");
  const archiveStart = actions.indexOf("export async function archiveConversation");
  const renameFn = actions.slice(renameStart, archiveStart);
  const archiveFn = actions.slice(
    actions.indexOf("async function setConversationArchivedAt"),
    actions.indexOf("async function prepareOwnedConversationAction"),
  );

  assert.equal(renameFn.includes(".update({ title: validation.title })"), true);
  assert.equal(renameFn.includes("description"), false);
  assert.equal(renameFn.includes("source_description_hash"), false);
  assert.equal(renameFn.includes("case_analyses"), false);
  assert.equal(renameFn.includes("case_questions"), false);
  assert.equal(renameFn.includes("case_messages"), false);
  assert.equal(archiveFn.includes(".update({ archived_at: archivedAt })"), true);
  assert.equal(archiveFn.includes("description"), false);
  assert.equal(archiveFn.includes("case_analyses"), false);
  assert.equal(archiveFn.includes("case_questions"), false);
  assert.equal(archiveFn.includes("case_messages"), false);
  assert.equal(archiveFn.includes(".delete("), false);
});

test("delete uses the owned case hard-delete path so messages and intelligence cascade", () => {
  const actions = readFileSync(join(directory, "actions.ts"), "utf8");
  const deleteStart = actions.indexOf("export async function deleteConversation");
  const deleteFn = actions.slice(
    deleteStart,
    actions.indexOf("async function setConversationArchivedAt"),
  );

  assert.equal(deleteFn.includes('.from("cases")'), true);
  assert.equal(deleteFn.includes(".delete()"), true);
  assert.equal(deleteFn.includes(".eq(\"id\", prepared.caseId)"), true);
  assert.equal(deleteFn.includes("createClient"), false);
});

test("conversation management is owner-scoped and cannot target another user", () => {
  const actions = readFileSync(join(directory, "actions.ts"), "utf8");
  const listCases = readFileSync(
    join(directory, "../cases/listCases.ts"),
    "utf8",
  );
  const menu = readFileSync(join(directory, "ConversationMenu.tsx"), "utf8");

  assert.equal(actions.includes("SERVICE_ROLE"), false);
  assert.equal(actions.includes("createClient"), true);
  assert.equal(actions.includes("@/lib/supabase/server"), true);
  assert.equal(actions.includes(".maybeSingle()"), true);
  assert.equal(actions.includes(".eq(\"user_id\""), false);
  assert.equal(listCases.includes('.is("archived_at", null)'), true);
  assert.equal(listCases.includes('.not("archived_at", "is", null)'), true);
  assert.equal(menu.includes("Delete this conversation permanently?"), true);
  assert.equal(menu.includes("Rename"), true);
  assert.equal(menu.includes("Archive"), true);
});
