import type {
  SituationUnderstanding,
  StoredQuestion,
  UserFact,
} from "@/types/situationUnderstanding";

type SituationBriefProps = {
  understanding: SituationUnderstanding;
  questions: StoredQuestion[];
};

export function SituationBrief({
  understanding,
  questions,
}: SituationBriefProps) {
  return (
    <div className="flex flex-col gap-6">
      <FactSection facts={understanding.userFacts} />
      {understanding.parties.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-stone-900">People involved</h3>
          <ul className="flex flex-col gap-2">
            {understanding.parties.map((party) => (
              <li key={`${party.label}:${party.role}`} className="leading-7 text-stone-700">
                <span className="font-medium text-stone-900">{party.label}</span>
                <span className="text-stone-500"> — {party.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <TextSection title="What Aram inferred" items={understanding.inferences} />
      <TextSection title="What Aram assumed" items={understanding.assumptions} />
      <TextSection title="Situation themes" items={understanding.situationThemes} />
      <TextSection
        title="What is still missing"
        items={understanding.missingInformation}
      />
      <TextSection
        title="What is still uncertain"
        items={understanding.uncertainties}
      />
      {questions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-stone-900">
            Questions to help fill the gaps
          </h3>
          <ol className="flex flex-col gap-4">
            {questions.map((question) => (
              <li key={question.id} className="flex flex-col gap-1">
                <p className="leading-7 text-stone-900">{question.question}</p>
                <p className="text-sm leading-6 text-stone-600">
                  Why this was asked: {question.why_it_matters}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function FactSection({ facts }: { facts: UserFact[] }) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-stone-900">Your words</h3>
      <ul className="flex flex-col gap-3">
        {facts.map((fact) => (
          <li key={`${fact.source_kind}:${fact.quote}`} className="flex flex-col gap-1">
            <p className="leading-7 text-stone-900">{fact.text}</p>
            <p className="text-sm leading-6 text-stone-600">“{fact.quote}”</p>
            <p className="text-sm text-stone-500">{sourceLabel(fact)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TextSection({
  title,
  items,
}: {
  title: string;
  items: { text: string }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.text} className="leading-7 text-stone-700">
            {item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function sourceLabel(fact: UserFact): string {
  if (fact.source_kind === "answer") {
    return "From a follow-up answer";
  }

  return "From your description";
}
