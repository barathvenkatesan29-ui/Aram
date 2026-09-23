import { ConversationWorkspace } from "@/features/chat/ConversationWorkspace";
import { conversationDisplayTitle } from "@/features/chat/groupConversations";
import { getConversation } from "@/features/chat/getConversation";
import { parseCaseId } from "@/features/cases/parseCaseId";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Conversation",
};

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseId = parseCaseId(id);

  if (!caseId) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect(`/sign-in?next=/chat/${caseId}`);
  }

  const conversation = await getConversation(caseId);

  if (!conversation) {
    notFound();
  }

  const heading = conversationDisplayTitle({
    id: conversation.savedCase.id,
    title: conversation.savedCase.title,
    created_at: conversation.savedCase.created_at,
    updated_at: conversation.savedCase.updated_at,
    archived_at: null,
  });

  return (
    <ConversationWorkspace
      heading={heading}
      caseId={conversation.savedCase.id}
      messages={conversation.messages}
      aramTurn={conversation.aramTurn}
      frozen={!conversation.canAppend}
      clarification={conversation.clarification}
      details={conversation.details}
      detailsEmptyCopy="Aram will organise what you share here after there is enough to work with."
    />
  );
}
