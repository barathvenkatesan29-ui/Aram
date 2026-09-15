import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/features/auth/SignInForm";
import { getSafeNextPath } from "@/features/auth/safeNextPath";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
};

function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(firstSearchParam(params.next));
  const authError = firstSearchParam(params.error) === "auth";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <SignInForm authError={authError} />
    </main>
  );
}
