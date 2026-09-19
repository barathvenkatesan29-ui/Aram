import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";
import { CaseDetailForm } from "@/features/cases/CaseDetailForm";
import { formatCaseLabel } from "@/features/cases/formatCaseLabel";
import { getCase } from "@/features/cases/getCase";
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
    redirect(`/sign-in?next=/cases/${caseId}`);
  }

  const savedCase = await getCase(caseId);

  if (!savedCase) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
            Saved case
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            {formatCaseLabel(savedCase.created_at)}
          </h1>
          <p className="leading-7 text-stone-600">
            This description is saved with your account. Only you can see it.
            You can change it or permanently delete it. Later steps are not
            open yet. It was not analysed.
          </p>
        </header>

        <LegalInformationNotice />

        <CaseDetailForm
          caseId={savedCase.id}
          description={savedCase.description}
        />

        <p className="flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href="/cases"
            className="text-sm font-medium text-teal-800 hover:text-teal-900"
          >
            Your cases
          </Link>
          <Link
            href="/start"
            className="text-sm font-medium text-teal-800 hover:text-teal-900"
          >
            Describe another situation
          </Link>
        </p>
      </div>
    </main>
  );
}
