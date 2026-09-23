export const MIN_CONVERSATION_TITLE_LENGTH = 1;
export const MAX_CONVERSATION_TITLE_LENGTH = 80;

export type ConversationTitleValidationResult =
  | { ok: true; title: string }
  | { ok: false; message: string };

export function validateConversationTitle(
  rawTitle: string,
): ConversationTitleValidationResult {
  const title = rawTitle.trim();

  if (title.length < MIN_CONVERSATION_TITLE_LENGTH) {
    return {
      ok: false,
      message: "Please enter a name for this conversation.",
    };
  }

  if (title.length > MAX_CONVERSATION_TITLE_LENGTH) {
    return {
      ok: false,
      message: "Please shorten the name. This version accepts up to 80 characters.",
    };
  }

  return { ok: true, title };
}

export function isArchivedConversation(archivedAt: string | null): boolean {
  return archivedAt !== null && archivedAt.length > 0;
}

export function selectActiveConversations<T extends { archived_at: string | null }>(
  conversations: T[],
): T[] {
  return conversations.filter((conversation) => !isArchivedConversation(conversation.archived_at));
}

export function selectArchivedConversations<T extends { archived_at: string | null }>(
  conversations: T[],
): T[] {
  return conversations.filter((conversation) => isArchivedConversation(conversation.archived_at));
}
