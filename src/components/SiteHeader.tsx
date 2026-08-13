import Link from "next/link";

const navigation = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-6 px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-stone-900"
        >
          Aram
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          <nav aria-label="Main">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-stone-900">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/start"
            className="inline-flex h-10 items-center justify-center rounded-full bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
          >
            Describe what happened
          </Link>
        </div>
      </div>
    </header>
  );
}
