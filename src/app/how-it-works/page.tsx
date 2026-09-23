import type { Metadata } from "next";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";

export const metadata: Metadata = {
  title: "How it works",
};

const laterSteps = [
  {
    title: "Aram organises the facts",
    body: "Aram picks out the important facts, the people involved, and what information is still missing.",
  },
  {
    title: "Aram asks only necessary questions",
    body: "If something important is missing, Aram asks a short set of follow-up questions — not an endless interview.",
  },
  {
    title: "Aram looks up official Indian legal information",
    body: "Where it can, Aram retrieves relevant information from authoritative sources and shows where that information came from.",
  },
  {
    title: "Aram keeps different kinds of information apart",
    body: "You should be able to see what you said, what Aram inferred, what it assumed, what came from a legal source, and what is still uncertain.",
  },
  {
    title: "Aram explains a safer next step",
    body: "Aram outlines possible rights, legal boundaries, and a cautious path toward resolution. It does not promise a result.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          How Aram works
        </h1>
        <p className="text-lg leading-8 text-stone-600">
          Aram is being built around a simple journey: understand the situation,
          know your possible rights and limits, and take a safer step toward
          resolution.
        </p>
      </header>

      <LegalInformationNotice />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          What this version does
        </h2>
        <p className="leading-7 text-stone-600">
          You can sign in with an email link. Aram asks only for your email
          address to create and sign in to your account. You can start a
          conversation in your own words, return to it later, or permanently
          delete it. Other Aram users cannot see those conversations. A
          conversation is available only through your signed-in account.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          What this version does not do yet
        </h2>
        <p className="leading-7 text-stone-600">
          Answering follow-up questions, official legal research, a recommended
          path, and tracking outcomes are not open yet. Aram does not file
          anything on your behalf, prepare court documents, or act through
          software agents.
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-stone-900">
            What Aram is being built toward
          </h2>
          <p className="leading-7 text-stone-600">
            These later steps are not open yet. They describe the path Aram is
            being built toward. They do not describe what this version already
            does.
          </p>
        </div>
        <ol className="flex flex-col gap-6">
          {laterSteps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-medium text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-stone-900">
                  {step.title}
                </h3>
                <p className="leading-7 text-stone-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
