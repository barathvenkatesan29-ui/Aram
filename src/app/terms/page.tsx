import type { Metadata } from "next";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Terms of use
        </h1>
        <p className="text-lg leading-8 text-stone-600">
          These terms explain what Aram is, and what it is not, while the
          product is being built.
        </p>
      </header>

      <LegalInformationNotice />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          Legal information, not representation
        </h2>
        <p className="leading-7 text-stone-600">
          Aram provides general legal information to help you understand a
          situation and consider a safer next step. Aram is not a law firm. It
          does not form a lawyer–client relationship. It does not represent you
          before a court, a police station, a government office, or any other
          body.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">No guaranteed outcomes</h2>
        <p className="leading-7 text-stone-600">
          Legal results depend on facts, evidence, procedure, time limits, and
          decisions by other people and institutions. Aram does not promise that
          a path will succeed, or that a particular law will apply to you.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          When you should speak to a lawyer
        </h2>
        <p className="leading-7 text-stone-600">
          If you face arrest, violence, a court deadline, a notice that requires
          a response, or any situation where a mistake could cause serious harm,
          speak with a qualified legal professional. Do not rely on this website
          as a substitute for that help.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">This version of the site</h2>
        <p className="leading-7 text-stone-600">
          These pages are informational. You cannot submit a case or create an
          account here yet. Using this website does not create any duty for Aram
          to act on your behalf.
        </p>
      </section>
    </main>
  );
}
