import Link from "next/link";

export default function ChatNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Conversation not found
      </h1>
      <p className="leading-7 text-stone-600">
        This conversation is not available in your account.
      </p>
      <p>
        <Link href="/chat" className="text-sm font-medium text-teal-800 hover:text-teal-900">
          Start a new chat
        </Link>
      </p>
    </main>
  );
}
