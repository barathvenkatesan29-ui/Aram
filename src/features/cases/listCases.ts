import { createClient } from "@/lib/supabase/server";
import type { CaseListItem } from "@/types/case";
import { parseCaseId } from "./parseCaseId";

export type ListCasesResult =
  | { ok: true; cases: CaseListItem[] }
  | { ok: false };

function isCaseListItem(value: unknown): value is CaseListItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as {
    id?: unknown;
    created_at?: unknown;
  };

  return (
    typeof record.id === "string" &&
    parseCaseId(record.id) !== null &&
    typeof record.created_at === "string"
  );
}

export async function listCases(): Promise<ListCasesResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listCases failed", {
      name: error.name,
      code: error.code,
    });
    return { ok: false };
  }

  if (!Array.isArray(data)) {
    return { ok: false };
  }

  const cases: CaseListItem[] = [];

  for (const row of data) {
    if (!isCaseListItem(row)) {
      console.error("listCases failed", { reason: "invalid-list-item" });
      return { ok: false };
    }

    cases.push({
      id: parseCaseId(row.id) ?? row.id,
      created_at: row.created_at,
    });
  }

  return { ok: true, cases };
}
