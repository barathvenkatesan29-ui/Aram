"use server";

import { redirect } from "next/navigation";
import { validateCaseDescription } from "@/features/case-intake/validateCaseDescription";
import { createClient } from "@/lib/supabase/server";
import type { CaseInsert, CreateCaseResult } from "@/types/case";
import { parseCaseId } from "./parseCaseId";

function getSignedInUserId(claims: { sub?: unknown } | undefined): string | null {
  if (typeof claims?.sub !== "string") {
    return null;
  }

  return parseCaseId(claims.sub);
}

export async function createCase(
  caseDescription: string,
): Promise<CreateCaseResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = getSignedInUserId(data?.claims);

  if (!userId) {
    return {
      ok: false,
      message: "Your sign-in has expired. Sign in again, then save.",
    };
  }

  const validation = validateCaseDescription(caseDescription);

  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
    };
  }

  const caseInsert: CaseInsert = {
    user_id: userId,
    description: caseDescription.trim(),
  };

  const { data: insertedCase, error } = await supabase
    .from("cases")
    .insert(caseInsert)
    .select("id")
    .single();

  if (error) {
    console.error("createCase failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not save your case. Please try again.",
    };
  }

  const insertedId =
    typeof insertedCase?.id === "string" ? parseCaseId(insertedCase.id) : null;

  if (!insertedId) {
    console.error("createCase failed", { reason: "invalid-inserted-id" });
    return {
      ok: false,
      message: "We could not save your case. Please try again.",
    };
  }

  redirect(`/cases/${insertedId}`);
}
