import { redirect } from "next/navigation";
import { listArchivedCases } from "@/features/cases/listCases";
import { ArchivedConversationList } from "@/features/chat/ArchivedConversationList";
import { createClient } from "@/lib/supabase/server";

export default async function ArchivedConversationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/sign-in?next=/chat/archived");
  }

  const listResult = await listArchivedCases();

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-50">
      <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-3">
        <h1 className="truncate text-sm font-semibold text-stone-900">Archived</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6">
        {listResult.ok ? (
          <ArchivedConversationList conversations={listResult.cases} />
        ) : (
          <p role="alert" className="text-sm text-red-800">
            We could not load your archived conversations. Please try again.
          </p>
        )}
      </div>
    </section>
  );
}
