"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCaseDescription } from "@/features/case-intake/validateCaseDescription";
import { createClient } from "@/lib/supabase/server";
import type {
  CaseInsert,
  CreateCaseResult,
  DeleteCaseResult,
  UpdateCaseResult,
} from "@/types/case";
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

  revalidatePath("/chat");
  revalidatePath("/cases");
  redirect(`/chat/${insertedId}`);
}

export async function updateCase(
  rawCaseId: string,
  caseDescription: string,
): Promise<UpdateCaseResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = getSignedInUserId(data?.claims);

  if (!userId) {
    return {
      ok: false,
      message: "Your sign-in has expired. Sign in again, then save.",
    };
  }

  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return {
      ok: false,
      message: "We could not save your case. Please try again.",
    };
  }

  const validation = validateCaseDescription(caseDescription);

  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
    };
  }

  const { data: updatedCase, error } = await supabase
    .from("cases")
    .update({ description: caseDescription.trim() })
    .eq("id", caseId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateCase failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not save your case. Please try again.",
    };
  }

  const updatedId =
    typeof updatedCase?.id === "string" ? parseCaseId(updatedCase.id) : null;

  if (!updatedId) {
    return {
      ok: false,
      message: "We could not save your case. Please try again.",
    };
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${updatedId}`);
  revalidatePath("/cases");
  revalidatePath(`/cases/${updatedId}`);
  return { ok: true };
}

export async function deleteCase(rawCaseId: string): Promise<DeleteCaseResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = getSignedInUserId(data?.claims);

  if (!userId) {
    return {
      ok: false,
      message: "Your sign-in has expired. Sign in again, then try again.",
    };
  }

  const caseId = parseCaseId(rawCaseId);

  if (!caseId) {
    return {
      ok: false,
      message: "We could not delete this case. Please try again.",
    };
  }

  const { data: deletedCase, error } = await supabase
    .from("cases")
    .delete()
    .eq("id", caseId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteCase failed", {
      name: error.name,
      code: error.code,
    });
    return {
      ok: false,
      message: "We could not delete this case. Please try again.",
    };
  }

  const deletedId =
    typeof deletedCase?.id === "string" ? parseCaseId(deletedCase.id) : null;

  if (!deletedId) {
    return {
      ok: false,
      message: "We could not delete this case. Please try again.",
    };
  }

  revalidatePath("/chat");
  revalidatePath("/cases");
  redirect("/chat");
}
