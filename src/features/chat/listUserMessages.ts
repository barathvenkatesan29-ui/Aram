import { parseCaseId } from "@/features/cases/parseCaseId";
import { createClient } from "@/lib/supabase/server";
import { parseUuid } from "@/features/situation-understanding/parseUuid";

export type UserChatMessage = {
  id: string;
  body: string;
  created_at: string;
};

function isUserChatMessage(value: unknown): value is UserChatMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as {
    id?: unknown;
    body?: unknown;
    created_at?: unknown;
    question_id?: unknown;
  };

  return (
    typeof record.id === "string" &&
    parseUuid(record.id) !== null &&
    typeof record.body === "string" &&
    typeof record.created_at === "string"
  );
}

export async function listUserMessages(
  rawCaseId: string,
): Promise<UserChatMessage[] | null> {
  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_messages")
    .select("id, body, created_at, question_id")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("listUserMessages failed", {
      name: error.name,
      code: error.code,
    });
    return null;
  }

  if (!Array.isArray(data)) {
    return null;
  }

  const messages: UserChatMessage[] = [];

  for (const row of data) {
    if (!isUserChatMessage(row)) {
      console.error("listUserMessages failed", { reason: "invalid-message-row" });
      return null;
    }

    messages.push({
      id: parseUuid(row.id) ?? row.id,
      body: row.body,
      created_at: row.created_at,
    });
  }

  return messages;
}
