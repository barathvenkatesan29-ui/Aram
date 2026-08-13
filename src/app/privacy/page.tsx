import type { Metadata } from "next";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          Privacy
        </h1>
        <p className="text-lg leading-8 text-stone-600">
          Aram is meant to handle sensitive legal problems. Privacy will be
          treated as a core requirement, not an afterthought.
        </p>
      </header>

      <LegalInformationNotice />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          This version of the website
        </h2>
        <p className="leading-7 text-stone-600">
          This version does not create accounts. You can type a case description
          when you start a case. Aram does not send or store your case
          description in this phase. There is no analytics on these pages.
          Opening a page still makes an ordinary request to load the website.
        </p>
        <p className="leading-7 text-stone-600">
          Your browser, keyboard, operating system, or installed writing tools
          can still process text you type. That happens outside Aram&apos;s
          control.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          What later versions intend to collect
        </h2>
        <p className="leading-7 text-stone-600">
          When accounts and cases are added, Aram expects to collect only what
          is needed to provide the service. That is likely to include an email
          address for signing in, and the description and answers you choose to
          type about a case.
        </p>
        <p className="leading-7 text-stone-600">
          Case information will be treated as private to you. Another user
          should not be able to see your case. Case text should not appear in
          page addresses or public logs.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">What we will not do</h2>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-stone-600">
          <li>We will not ask for identity numbers unless a later official process truly needs them</li>
          <li>We will not sell your case information</li>
          <li>We will not put your story into public marketing or open logs</li>
        </ul>
      </section>
    </main>
  );
}
