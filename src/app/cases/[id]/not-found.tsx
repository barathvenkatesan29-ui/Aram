import Link from "next/link";

export default function CaseNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
          This case is not available.
        </h1>
        <Link
          href="/start"
          className="text-sm font-medium text-teal-800 hover:text-teal-900"
        >
          Describe another situation
        </Link>
      </div>
    </main>
  );
}
