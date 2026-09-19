import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCaseLabel } from "@/features/cases/formatCaseLabel";
import { listCases } from "@/features/cases/listCases";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your cases",
};

export default async function CasesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/sign-in?next=/cases");
  }

  const listResult = await listCases();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
            Your cases
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Saved descriptions
          </h1>
          <p className="leading-7 text-stone-600">
            Other Aram users cannot see these. They are available only through
            your signed-in account. Open a case to read, change, or delete it.
            Later steps are not open yet.
          </p>
        </header>

        {listResult.ok ? (
          listResult.cases.length === 0 ? (
            <p className="leading-7 text-stone-600">
              You have not saved a case yet.{" "}
              <Link
                href="/start"
                className="font-medium text-teal-800 hover:text-teal-900"
              >
                Describe what happened
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {listResult.cases.map((savedCase) => (
                <li key={savedCase.id}>
                  <Link
                    href={`/cases/${savedCase.id}`}
                    className="block rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-medium text-stone-900 hover:border-teal-800 hover:text-teal-900"
                  >
                    {formatCaseLabel(savedCase.created_at)}
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p role="alert" className="text-sm text-red-800">
            We could not load your cases. Please try again.
          </p>
        )}

        {listResult.ok && listResult.cases.length > 0 ? (
          <p>
            <Link
              href="/start"
              className="text-sm font-medium text-teal-800 hover:text-teal-900"
            >
              Describe another situation
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
