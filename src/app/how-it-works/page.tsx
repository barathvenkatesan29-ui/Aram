import type { Metadata } from "next";
import { LegalInformationNotice } from "@/components/LegalInformationNotice";

export const metadata: Metadata = {
  title: "How it works",
};

const steps = [
  {
    title: "You explain what happened",
    body: "You describe a legal problem in ordinary language. You do not need legal wording.",
  },
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
  {
    title: "You can come back to your cases",
    body: "Later, you will be able to view and track the cases you have started.",
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

      <ol className="flex flex-col gap-6">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-medium text-white"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-stone-900">
                {step.title}
              </h2>
              <p className="leading-7 text-stone-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-900">
          What this version does not do
        </h2>
        <p className="leading-7 text-stone-600">
          This first version of the website is information only. You cannot
          start a case here yet. Aram does not yet collect your story, create an
          account, file anything on your behalf, prepare court documents, or act
          through software agents.
        </p>
      </section>
    </main>
  );
}
