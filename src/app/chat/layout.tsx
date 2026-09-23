import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ChatShell } from "@/features/chat/ChatShell";
import { listArchivedCases, listCases } from "@/features/cases/listCases";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Chat",
};

export default async function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/sign-in?next=/chat");
  }

  const [listResult, archivedResult] = await Promise.all([
    listCases(),
    listArchivedCases(),
  ]);
  const listFailed = !listResult.ok || !archivedResult.ok;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ChatShell
        conversations={listResult.ok ? listResult.cases : []}
        archivedCount={archivedResult.ok ? archivedResult.cases.length : 0}
        listFailed={listFailed}
      >
        {children}
      </ChatShell>
    </div>
  );
}
