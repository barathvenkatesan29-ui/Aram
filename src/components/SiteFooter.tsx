import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-6 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
        <p>Aram — legal information for people in India.</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/how-it-works" className="hover:text-stone-900">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-stone-900">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-stone-900">
                Terms
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
