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
    title?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    archived_at?: unknown;
  };

  return (
    typeof record.id === "string" &&
    parseCaseId(record.id) !== null &&
    (record.title === null || typeof record.title === "string") &&
    typeof record.created_at === "string" &&
    typeof record.updated_at === "string" &&
    (record.archived_at === null || typeof record.archived_at === "string")
  );
}

function toCaseListItem(row: CaseListItem): CaseListItem {
  return {
    id: parseCaseId(row.id) ?? row.id,
    title: typeof row.title === "string" ? row.title : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
  };
}

async function listCasesByArchiveState(
  archived: boolean,
): Promise<ListCasesResult> {
  const supabase = await createClient();
  const query = supabase
    .from("cases")
    .select("id, title, created_at, updated_at, archived_at");

  const filteredQuery = archived
    ? query.not("archived_at", "is", null).order("archived_at", { ascending: false })
    : query.is("archived_at", null).order("updated_at", { ascending: false });

  const { data, error } = await filteredQuery;

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

    cases.push(toCaseListItem(row));
  }

  return { ok: true, cases };
}

export async function listCases(): Promise<ListCasesResult> {
  return listCasesByArchiveState(false);
}

export async function listArchivedCases(): Promise<ListCasesResult> {
  return listCasesByArchiveState(true);
}
