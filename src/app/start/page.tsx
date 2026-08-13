import type { Metadata } from "next";
import { CaseIntakeForm } from "@/features/case-intake/CaseIntakeForm";

export const metadata: Metadata = {
  title: "Describe what happened",
};

export default function StartPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <CaseIntakeForm />
    </main>
  );
}
