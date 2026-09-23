import { createClient } from "@/lib/supabase/server";
import type { CaseRecord } from "@/types/case";
import { parseCaseId } from "./parseCaseId";

function isCaseRecord(value: unknown): value is CaseRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as {
    id?: unknown;
    description?: unknown;
    title?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
  };

  return (
    typeof record.id === "string" &&
    parseCaseId(record.id) !== null &&
    typeof record.description === "string" &&
    (record.title === null || typeof record.title === "string") &&
    typeof record.created_at === "string" &&
    typeof record.updated_at === "string"
  );
}

export async function getCase(rawCaseId: string): Promise<CaseRecord | null> {
  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("id, description, title, created_at, updated_at")
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    console.error("getCase failed", {
      name: error.name,
      code: error.code,
    });
    return null;
  }

  if (!isCaseRecord(data)) {
    return null;
  }

  return {
    id: parseCaseId(data.id) ?? data.id,
    description: data.description,
    title: data.title,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
