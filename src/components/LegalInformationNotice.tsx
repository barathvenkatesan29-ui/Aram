export function LegalInformationNotice() {
  return (
    <aside
      className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-3 text-sm leading-7 text-stone-700"
      aria-label="Important notice"
    >
      <p>
        <strong className="font-semibold">Aram provides legal information, not
        legal representation.</strong>{" "}
        Aram is not a law firm and is not your lawyer. It does not guarantee
        legal outcomes. For advice about your situation, speak with a qualified
        legal professional.
      </p>
    </aside>
  );
}
