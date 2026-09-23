import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { parseCaseId } from "@/features/cases/parseCaseId";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Saved case",
};

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseId = parseCaseId(id);

  if (!caseId) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect(`/sign-in?next=/chat/${caseId}`);
  }

  redirect(`/chat/${caseId}`);
}
