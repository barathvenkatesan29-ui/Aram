import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(directory, "../../..");

function readRepo(fileName: string): string {
  return readFileSync(join(repoRoot, fileName), "utf8");
}

function extractFunction(sql: string, name: string): string {
  const replaceMarker = `create or replace function public.${name}`;
  const createMarker = `create function public.${name}`;
  const replaceStart = sql.indexOf(replaceMarker);
  const createStart = sql.indexOf(createMarker);
  const useReplace =
    replaceStart !== -1 && (createStart === -1 || replaceStart < createStart);
  const start = useReplace ? replaceStart : createStart;
  const markerLength = useReplace ? replaceMarker.length : createMarker.length;
  assert.notEqual(start, -1, `missing ${name}`);

  const searchFrom = start + markerLength;
  const nextReplace = sql.indexOf("create or replace function public.", searchFrom);
  const nextCreate = sql.indexOf("create function public.", searchFrom);
  const nextStarts = [nextReplace, nextCreate].filter((index) => index !== -1);
  const end = nextStarts.length === 0 ? sql.length : Math.min(...nextStarts);
  return sql.slice(start, end);
}

test("chat client modules do not import src/server/ai", () => {
  const composer = readFileSync(join(directory, "ChatComposer.tsx"), "utf8");
  const sidebar = readFileSync(join(directory, "ConversationSidebar.tsx"), "utf8");
  const thread = readFileSync(join(directory, "ChatThread.tsx"), "utf8");
  const panel = readFileSync(join(directory, "SituationPanel.tsx"), "utf8");
  const menu = readFileSync(join(directory, "ConversationMenu.tsx"), "utf8");
  const row = readFileSync(join(directory, "ConversationRow.tsx"), "utf8");
  const renameForm = readFileSync(join(directory, "ConversationRenameForm.tsx"), "utf8");
  const conversationChat = readFileSync(join(directory, "ConversationChat.tsx"), "utf8");
  const carousel = readFileSync(join(directory, "ClarificationCarousel.tsx"), "utf8");
  const workspace = readFileSync(join(directory, "ConversationWorkspace.tsx"), "utf8");
  const detailsPanel = readFileSync(join(directory, "DetailsPanel.tsx"), "utf8");
  const browser = readFileSync(join(directory, "BrowserWorkspace.tsx"), "utf8");
  const panelLayout = readFileSync(join(directory, "ChatPanelLayout.tsx"), "utf8");

  for (const source of [
    composer,
    sidebar,
    thread,
    panel,
    menu,
    row,
    renameForm,
    conversationChat,
    carousel,
    workspace,
    detailsPanel,
    browser,
    panelLayout,
  ]) {
    assert.equal(source.includes("server/ai"), false);
    assert.equal(source.includes("getProvider"), false);
  }
});

test("sendMessage freezes appends and skips understanding below readiness", () => {
  const sendMessage = readFileSync(join(directory, "actions.ts"), "utf8");
  const understandCase = readRepo(
    "src/features/situation-understanding/actions.ts",
  );

  assert.equal(sendMessage.includes("shouldAppendPreUnderstanding"), true);
  assert.ok(
    sendMessage.indexOf("shouldAppendPreUnderstanding") <
      sendMessage.indexOf("append_pre_understanding_message"),
  );
  assert.ok(
    sendMessage.indexOf("shouldAttemptInitialUnderstanding") <
      sendMessage.lastIndexOf("understandCase"),
  );
  assert.ok(
    understandCase.indexOf("isIntelligenceReady") <
      understandCase.indexOf("countRecentAnalyses"),
  );
  const persistIndex = understandCase.indexOf("persist_complete_initial_analysis");
  assert.ok(persistIndex !== -1);
  assert.ok(
    understandCase.indexOf("persistFriendlyTitleIfNeeded", persistIndex) !== -1,
  );
  assert.ok(
    understandCase.indexOf("finaliseAskabilityAfterPersist", persistIndex) !== -1,
  );
  assert.equal(sendMessage.includes("deriveConversationTitle"), false);
  assert.equal(understandCase.includes("shouldWriteConversationTitle"), true);
  assert.equal(understandCase.includes('.is("title", null)'), true);
  const composer = readFileSync(join(directory, "ChatComposer.tsx"), "utf8");
  assert.equal(composer.includes("frozenComposerBody"), true);
  assert.equal(composer.includes("Answering questions is not open"), false);
  assert.equal(composer.includes("I have organised what you have shared so far."), false);
  assert.equal(composer.includes("answerOptionalClarification"), false);
  assert.equal(composer.includes("Skip"), false);
  const sendStart = sendMessage.indexOf("export async function sendMessage");
  const sendEnd = sendMessage.indexOf(
    "export async function answerOptionalClarification",
    sendStart,
  );
  const sendFn = sendMessage.slice(sendStart, sendEnd);
  assert.equal(sendFn.includes("answer_optional_clarification"), false);
  assert.equal(sendFn.includes("append_pre_understanding_message"), true);
  assert.ok(
    sendFn.indexOf("FROZEN_FREE_TEXT_MESSAGE") <
      sendFn.indexOf("append_pre_understanding_message"),
  );
});

test("create RPC always opens a conversation from a 1-8000 character message without setting a title", () => {
  const sql = readRepo("supabase/migrations/20260920210000_create_case_messages.sql");
  const createFn = extractFunction(sql, "create_case_with_first_message");

  assert.equal(createFn.includes("char_length(v_body) < 1"), true);
  assert.equal(createFn.includes("char_length(v_body) > 8000"), true);
  assert.equal(createFn.includes("insert into public.cases (user_id, description)"), true);
  assert.equal(createFn.includes("title"), false);
});

test("append RPC serializes with FOR UPDATE and rolls back on 8000 overflow", () => {
  const sql = readRepo("supabase/migrations/20260920210000_create_case_messages.sql");
  const appendFn = extractFunction(sql, "append_pre_understanding_message");

  const lockIndex = appendFn.indexOf("for update");
  const insertIndex = appendFn.indexOf("insert into public.case_messages");
  const aggregateIndex = appendFn.indexOf("string_agg");
  const overflowIndex = appendFn.indexOf("errcode = '23514'");
  const updateIndex = appendFn.lastIndexOf("update public.cases");

  assert.ok(lockIndex !== -1 && lockIndex < insertIndex);
  assert.ok(insertIndex < aggregateIndex);
  assert.ok(appendFn.includes("order by message.created_at asc, message.id asc"));
  assert.match(appendFn, /E'\\n\\n'/);
  assert.equal(appendFn.includes("auth.uid()"), true);
  assert.ok(overflowIndex !== -1 && overflowIndex < updateIndex);
});

test("case_messages are user-only, append-only, and isolated by owner", () => {
  const sql = readRepo("supabase/migrations/20260920210000_create_case_messages.sql");

  assert.equal(sql.includes("create policy case_messages_select_own"), true);
  assert.equal(sql.includes("create policy case_messages_insert_own"), true);
  assert.equal(sql.includes("create policy case_messages_update"), false);
  assert.equal(sql.includes("create policy case_messages_delete"), false);
  assert.equal(sql.includes("check (source = 'text')"), true);
  assert.equal(sql.includes("(select auth.uid()) = user_id"), true);
  assert.equal(sql.includes("references public.cases (id, user_id)"), true);
  assert.equal(
    sql.includes("references public.case_questions (id, case_id, user_id)"),
    true,
  );
  assert.equal(/grant update[^\n]*on table public.case_messages/.test(sql), false);
  assert.equal(/grant delete[^\n]*on table public.case_messages/.test(sql), false);
});

test("description length is 1-8000 and title stays nullable until freeze", () => {
  const sql = readRepo("supabase/migrations/20260920210000_create_case_messages.sql");
  assert.equal(
    sql.includes("check (char_length(trim(description)) between 1 and 8000)"),
    true,
  );
  assert.equal(sql.includes("add column title text"), true);
  assert.equal(sql.includes("title is null"), true);
});

test("archive column is nullable and owner-updatable without service role", () => {
  const sql = readRepo("supabase/migrations/20260921100000_add_case_archived_at.sql");
  const analyses = readRepo("supabase/migrations/20260920130400_create_case_analyses.sql");
  const messages = readRepo("supabase/migrations/20260920210000_create_case_messages.sql");

  assert.equal(sql.includes("add column archived_at timestamptz"), true);
  assert.equal(sql.includes("grant update (archived_at) on table public.cases to authenticated"), true);
  assert.equal(sql.includes("SERVICE_ROLE"), false);
  assert.equal(analyses.includes("on delete cascade"), true);
  assert.equal(messages.includes("on delete cascade"), true);
});

test("4D clarification RPCs are owner-scoped invoker functions without service-role", () => {
  const sql = readRepo(
    "supabase/migrations/20260921170000_checkpoint_4d_clarification.sql",
  );
  const getConversation = readFileSync(join(directory, "getConversation.ts"), "utf8");
  const sendMessage = readFileSync(join(directory, "actions.ts"), "utf8");
  const conversationChat = readFileSync(
    join(directory, "ConversationChat.tsx"),
    "utf8",
  );
  const stub = readRepo("src/server/ai/stubProvider.ts");
  const organiser = readRepo("src/server/ai/organiseStubSituation.ts");

  assert.equal(sql.includes("security invoker"), true);
  assert.equal(sql.includes("SERVICE_ROLE"), false);
  assert.equal(sql.includes("service_role"), false);
  assert.equal(sql.includes("create function public.finalise_optional_clarification"), true);
  assert.equal(sql.includes("create function public.answer_optional_clarification"), true);
  assert.equal(sql.includes("create function public.persist_complete_follow_up"), true);
  assert.equal(sql.includes("grant execute on function public.finalise_optional_clarification"), true);
  assert.equal(sql.includes("answers must not rewrite the saved description"), true);
  assert.equal(sql.includes("for update"), true);
  assert.equal(getConversation.includes("finalise_optional_clarification"), false);
  assert.equal(getConversation.includes("answer_optional_clarification"), false);
  assert.equal(getConversation.includes(".update("), false);
  assert.equal(sendMessage.includes("export async function answerOptionalClarification"), true);
  const answerStart = sendMessage.indexOf(
    "export async function answerOptionalClarification",
  );
  const answerEnd = sendMessage.indexOf(
    "export async function skipOptionalClarification",
    answerStart,
  );
  const answerFn = sendMessage.slice(answerStart, answerEnd);
  assert.equal(answerFn.includes("append_pre_understanding_message"), false);
  assert.equal(answerFn.includes("understandCase"), false);
  assert.equal(answerFn.includes("runClarificationFollowUp"), true);
  assert.equal(sendMessage.includes("export async function skipOptionalClarification"), true);
  assert.equal(sendMessage.includes("reassessRemainingClarifications"), true);
  assert.equal(stub.includes("orientation_fork"), false);
  assert.equal(stub.includes("ask_now"), false);
  assert.equal(organiser.includes("questions: []"), true);
  assert.equal(organiser.includes("When did this happen?"), false);
  assert.equal(conversationChat.includes("ClarificationCarousel"), true);
  assert.equal(conversationChat.includes("Add this detail"), false);
});

test("4D multi-clarification RPCs keep multiple keep-ids, skip, and settled follow-up", () => {
  const sql = readRepo(
    "supabase/migrations/20260922120000_checkpoint_4d_multi_clarification.sql",
  );
  const carousel = readFileSync(join(directory, "ClarificationCarousel.tsx"), "utf8");

  assert.equal(sql.includes("add column keep_question_ids uuid[]"), true);
  assert.equal(sql.includes("create function public.finalise_optional_clarification"), true);
  assert.equal(sql.includes("p_keep_question_ids uuid[]"), true);
  assert.equal(sql.includes("create function public.skip_optional_clarification"), true);
  assert.equal(sql.includes("SERVICE_ROLE"), false);
  assert.equal(sql.includes("service_role"), false);
  assert.equal(sql.includes("security invoker"), true);
  assert.equal(sql.includes("p_question_id <> all (v_keep_question_ids)"), true);
  assert.equal(sql.includes("v_answered_keep_count < 1"), true);
  assert.equal(sql.includes("answers must not rewrite the saved description"), true);
  assert.equal(carousel.includes("Something else"), true);
  assert.equal(carousel.includes("Skip"), true);
  assert.equal(carousel.includes("Question 1 of"), false);
  assert.equal(carousel.includes("server/ai"), false);
});

test("4D multi-clarification finalise canonicalises keep ids as a set", () => {
  const sql = readRepo(
    "supabase/migrations/20260922120000_checkpoint_4d_multi_clarification.sql",
  );
  const finaliseFn = extractFunction(sql, "finalise_optional_clarification");

  assert.equal(finaliseFn.includes("where keep_id.id is null"), true);
  assert.equal(finaliseFn.includes("duplicate keep question"), true);
  assert.equal(
    finaliseFn.includes(
      "v_matching_keep_count is distinct from cardinality(p_keep_question_ids)",
    ),
    true,
  );
  assert.equal(finaliseFn.includes("owned_question.analysis_id = p_analysis_id"), true);
  assert.equal(finaliseFn.includes("owned_question.case_id = v_case_id"), true);
  assert.equal(finaliseFn.includes("owned_question.user_id = v_user_id"), true);
  assert.equal(
    finaliseFn.includes(
      "order by owned_question.position asc, owned_question.id asc",
    ),
    true,
  );
  assert.equal(
    finaliseFn.includes("is not distinct from v_canonical_keep_ids"),
    true,
  );
  assert.equal(
    finaliseFn.includes("is not distinct from p_keep_question_ids"),
    false,
  );
  assert.equal(finaliseFn.includes("v_canonical_keep_ids[1]"), true);
  assert.equal(finaliseFn.includes("p_keep_question_ids[1]"), false);
  assert.equal(finaliseFn.includes("v_first_keep_id,\n    v_canonical_keep_ids"), true);
});

test("4D multi-clarification answered retries match exactly after js_string_trim", () => {
  const sql = readRepo(
    "supabase/migrations/20260922120000_checkpoint_4d_multi_clarification.sql",
  );
  const answerFn = extractFunction(sql, "answer_optional_clarification");
  const matchIndex = answerFn.indexOf(
    "js_string_trim(coalesce(v_stored_answer, '')) is not distinct from v_body",
  );
  const returnIndex = answerFn.indexOf("return v_existing_message_id");
  const conflictIndex = answerFn.indexOf("optional clarification answer conflict");
  const pendingUpdate = answerFn.indexOf("set status = 'answered'");

  assert.equal(answerFn.includes("v_body := public.js_string_trim(p_body);"), true);
  assert.equal(answerFn.includes("trim(both from p_body)"), false);
  assert.equal(answerFn.includes("owned_question.answer"), true);
  assert.ok(matchIndex !== -1);
  assert.ok(returnIndex !== -1);
  assert.ok(conflictIndex !== -1);
  assert.ok(matchIndex < returnIndex);
  assert.ok(returnIndex < conflictIndex);
  assert.ok(pendingUpdate !== -1 && conflictIndex < pendingUpdate);
});

test("4D multi-clarification rollback restores insert policy before dropping keep_question_ids", () => {
  const sql = readRepo(
    "supabase/migrations/20260922120000_checkpoint_4d_multi_clarification.sql",
  );
  const header = sql.slice(0, sql.indexOf("\nalter table"));
  const restoreFunctions = header.indexOf(
    "restore the 4D finalise/answer/follow-up function bodies",
  );
  const restorePolicy = header.indexOf(
    "recreate the previous 4D case_analysis_askability_insert_own policy",
  );
  const revokeGrant = header.indexOf("revoke insert (keep_question_ids)");
  const dropMatch = header.indexOf(
    "drop constraint case_analysis_askability_keep_ids_match",
  );
  const dropLimit = header.indexOf(
    "drop constraint case_analysis_askability_keep_ids_limit",
  );
  const dropColumn = header.indexOf("drop column keep_question_ids");

  assert.ok(restoreFunctions !== -1 && restoreFunctions < dropColumn);
  assert.ok(restorePolicy !== -1 && restorePolicy < dropColumn);
  assert.ok(revokeGrant !== -1 && revokeGrant < dropColumn);
  assert.ok(dropMatch !== -1 && dropMatch < dropColumn);
  assert.ok(dropLimit !== -1 && dropLimit < dropColumn);
  assert.ok(restorePolicy < revokeGrant);
  assert.ok(revokeGrant < dropMatch);
  assert.ok(dropMatch < dropLimit);
  assert.ok(dropLimit < dropColumn);
});

test("4D multi-clarification insert policy requires pending owned keep ids", () => {
  const sql = readRepo(
    "supabase/migrations/20260922120000_checkpoint_4d_multi_clarification.sql",
  );
  const start = sql.indexOf("create policy case_analysis_askability_insert_own");
  const end = sql.indexOf(
    "drop function if exists public.finalise_optional_clarification",
  );
  const policy = sql.slice(start, end);
  const pendingCount =
    policy.split("owned_question.status = 'pending'").length - 1;

  assert.notEqual(start, -1);
  assert.ok(end > start);
  assert.equal(policy.includes("(select auth.uid()) = user_id"), true);
  assert.equal(policy.includes("unnest(keep_question_ids)"), true);
  assert.equal(pendingCount >= 2, true);
  assert.equal(policy.includes("count(distinct keep_id.id)"), true);
});

test("4D follow-up requires a finalised answered keep-question and linked message", () => {
  const sql = readRepo(
    "supabase/migrations/20260921170000_checkpoint_4d_clarification.sql",
  );
  const followUpFn = extractFunction(sql, "persist_complete_follow_up");

  assert.equal(followUpFn.includes("from public.case_analysis_askability"), true);
  assert.equal(followUpFn.includes("v_keep_question_id is null"), true);
  assert.equal(followUpFn.includes("follow-up requires an answered optional clarification"), true);
  assert.equal(followUpFn.includes("v_keep_status is distinct from 'answered'"), true);
  assert.equal(followUpFn.includes("from public.case_messages as message"), true);
  assert.equal(followUpFn.includes("message.question_id = v_keep_question_id"), true);
  assert.equal(followUpFn.includes("status = 'pending'"), true);
  assert.equal(
    followUpFn.includes("complete follow-up requires no pending parent questions"),
    true,
  );
  assert.equal(followUpFn.includes("question_count = 0"), false);
});

test("4D finalise is exactly idempotent and conflicts on a different keep", () => {
  const sql = readRepo(
    "supabase/migrations/20260921170000_checkpoint_4d_clarification.sql",
  );
  const finaliseFn = extractFunction(sql, "finalise_optional_clarification");
  const conflictIndex = finaliseFn.indexOf("askability decision conflict");
  const sameDecisionIndex = finaliseFn.indexOf(
    "is not distinct from p_keep_question_id",
  );

  assert.ok(sameDecisionIndex !== -1);
  assert.ok(conflictIndex !== -1);
  assert.ok(sameDecisionIndex < conflictIndex);
  assert.equal(finaliseFn.includes("if found then"), true);
});

test("4D RPCs reject stale initials using the existing description-hash semantics", () => {
  const sql = readRepo(
    "supabase/migrations/20260921170000_checkpoint_4d_clarification.sql",
  );
  const hashCaseInput = readRepo(
    "src/features/situation-understanding/hashCaseInput.ts",
  );
  const finaliseFn = extractFunction(sql, "finalise_optional_clarification");
  const answerFn = extractFunction(sql, "answer_optional_clarification");
  const followUpFn = extractFunction(sql, "persist_complete_follow_up");

  assert.equal(hashCaseInput.includes('createHash("sha256")'), true);
  assert.equal(hashCaseInput.includes("description.trim()"), true);

  for (const fn of [finaliseFn, answerFn, followUpFn]) {
    assert.equal(fn.includes("extensions.digest"), true);
    assert.equal(fn.includes("sha256"), true);
    assert.equal(fn.includes("public.js_string_trim(v_description)"), true);
    assert.equal(fn.includes("convert_to('[]', 'UTF8')"), true);
    assert.equal(fn.includes("source_description_hash = v_description_hash"), true);
    assert.equal(fn.includes("source_answers_hash = v_empty_answers_hash"), true);
    assert.equal(fn.includes("analysis is not the current initial"), true);
    assert.equal(fn.includes("order by analysis.created_at desc, analysis.id desc"), true);
  }

  assert.equal(
    followUpFn.includes("p_source_description_hash is distinct from v_description_hash"),
    true,
  );
  assert.equal(
    followUpFn.includes("v_parent_description_hash is distinct from v_description_hash"),
    true,
  );
  assert.equal(followUpFn.includes("v_description_hash,"), true);
  assert.equal(followUpFn.includes("v_answers_hash"), true);
  assert.equal(followUpFn.includes("p_source_answers_hash is distinct from v_answers_hash"), true);
  assert.equal(followUpFn.includes("to_json(owned_question.id::text)"), true);
  assert.equal(followUpFn.includes("order by owned_question.position"), true);
  assert.equal(followUpFn.includes("public.js_string_trim(owned_question.answer)"), true);
});

test("4D answer re-locks the question after locking the owned case", () => {
  const sql = readRepo(
    "supabase/migrations/20260921170000_checkpoint_4d_clarification.sql",
  );
  const answerFn = extractFunction(sql, "answer_optional_clarification");
  const caseLock = answerFn.indexOf("from public.cases as owned_case");
  const caseForUpdate = answerFn.indexOf("for update", caseLock);
  const questionRelock = answerFn.indexOf(
    "from public.case_questions as owned_question",
    caseForUpdate,
  );
  const questionForUpdate = answerFn.indexOf("for update", questionRelock);
  const statusAct = answerFn.indexOf("if v_status = 'answered' then", questionForUpdate);

  assert.ok(caseLock !== -1 && caseForUpdate !== -1);
  assert.ok(caseLock < caseForUpdate);
  assert.ok(questionRelock !== -1 && questionForUpdate !== -1);
  assert.ok(caseForUpdate < questionRelock);
  assert.ok(questionRelock < questionForUpdate);
  assert.ok(statusAct !== -1 && questionForUpdate < statusAct);
  assert.equal(answerFn.includes("return v_existing_message_id"), true);
});
