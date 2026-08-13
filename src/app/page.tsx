import Link from "next/link";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-12">
      <section className="flex flex-col gap-6">
        <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
          For people in India
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-stone-900">
          Understand a legal problem, and find a safer path forward.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-stone-600">
          Aram is a legal information and resolution platform. You describe what
          happened in ordinary language. Aram helps you see the important facts,
          possible rights under Indian law, legal boundaries, and a cautious
          next step — without pretending to be your lawyer.
        </p>
        <div className="flex flex-col items-start gap-3">
          <Link
            href="/start"
            className="inline-flex h-12 items-center justify-center rounded-full bg-teal-800 px-6 text-base font-medium text-white hover:bg-teal-900"
          >
            Describe what happened
          </Link>
          <p className="text-sm text-stone-500">
            This opens the first step. Later steps are not built yet.
          </p>
        </div>
      </section>

      <LegalInformationNotice />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-stone-900">What Aram is for</h2>
        <p className="leading-7 text-stone-600">
          People face many kinds of legal situations in India — at home, at
          work, with a purchase, with a landlord, with an institution, or in
          other parts of daily life. Aram helps you understand what appears to
          have happened and what a safer next step may be.
        </p>
        <p className="leading-7 text-stone-600">
          That can include situations involving purchases, work, housing,
          institutions, services, or other parts of daily life.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-stone-900">What Aram will help you do</h2>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-stone-600">
          <li>Describe a problem in your own words</li>
          <li>See the important facts, and what is still missing</li>
          <li>Understand who appears to be involved</li>
          <li>Learn possible rights and legal boundaries</li>
          <li>Read a cautious recommended path toward resolution</li>
          <li>Return later and look at your cases</li>
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-stone-900">What Aram is not</h2>
        <ul className="list-disc space-y-2 pl-5 leading-7 text-stone-600">
          <li>Aram is not a law firm and does not represent you</li>
          <li>Aram does not guarantee a legal outcome</li>
          <li>Aram does not file complaints or court papers for you</li>
          <li>Aram does not replace a qualified legal professional</li>
        </ul>
      </section>
    </main>
  );
}
