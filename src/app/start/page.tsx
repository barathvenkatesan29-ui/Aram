import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CaseIntakeForm } from "@/features/case-intake/CaseIntakeForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Describe what happened",
};

export default async function StartPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/sign-in?next=/start");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <CaseIntakeForm />
    </main>
  );
}
