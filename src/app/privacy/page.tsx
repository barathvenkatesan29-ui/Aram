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
          You can sign in with an email link. Aram asks only for your email
          address to create and sign in to your account. The sign-in service
          also stores technical account and session information needed to
          operate authentication. Aram keeps you signed in with session cookies
          on this device.
        </p>
        <p className="leading-7 text-stone-600">
          After you sign in, you can type a case description and save it. Aram
          stores that description with your account. You can open it later,
          change it, or delete it. Organising facts, follow-up questions, and
          legal research are not open in this version.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          Who can see a saved case
        </h2>
        <p className="leading-7 text-stone-600">
          Other Aram users cannot see your saved cases. Your case is available
          only through your signed-in account, while Aram&apos;s infrastructure
          providers may technically process or access stored data as part of
          providing the service.
        </p>
        <p className="leading-7 text-stone-600">
          The list of your cases shows a date and time, not the story. The full
          description appears only when you open the case. Case text does not
          appear in page addresses or public logs. There is no analytics on
          these pages. Opening a page still makes an ordinary request to load
          the website.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">Deletion</h2>
        <p className="leading-7 text-stone-600">
          You can delete a saved case. Deletion removes it. It cannot be
          restored.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          What Aram does not collect here
        </h2>
        <p className="leading-7 text-stone-600">
          This version does not ask for identity-number fields, a phone number,
          payment details, or document uploads. Names and places may appear if
          you type them into a description.
        </p>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-stone-600">
          <li>
            We will not ask for identity numbers unless a later official process
            truly needs them
          </li>
          <li>We will not sell your case information</li>
          <li>
            We will not put your story into public marketing or open logs
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">Limits</h2>
        <p className="leading-7 text-stone-600">
          Your browser, keyboard, operating system, or installed writing tools
          can still process text you type. That happens outside Aram&apos;s
          control.
        </p>
      </section>
    </main>
  );
}
