import { formatCaseLabel } from "../cases/formatCaseLabel.ts";

export type ConversationListItem = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ConversationGroup = {
  label: string;
  conversations: ConversationListItem[];
};

export function conversationDisplayTitle(conversation: ConversationListItem): string {
  const trimmedTitle = conversation.title?.trim() ?? "";

  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }

  return formatCaseLabel(conversation.created_at);
}

export function groupConversationsByRecency(
  conversations: ConversationListItem[],
  now: Date = new Date(),
): ConversationGroup[] {
  const groups: Record<string, ConversationListItem[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 days": [],
    Older: [],
  };

  for (const conversation of conversations) {
    const activityAt = new Date(conversation.updated_at);

    if (Number.isNaN(activityAt.getTime())) {
      groups.Older.push(conversation);
      continue;
    }

    const startOfToday = startOfDayIst(now);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (activityAt.getTime() >= startOfToday.getTime()) {
      groups.Today.push(conversation);
    } else if (activityAt.getTime() >= startOfYesterday.getTime()) {
      groups.Yesterday.push(conversation);
    } else if (activityAt.getTime() >= startOfWeek.getTime()) {
      groups["Last 7 days"].push(conversation);
    } else {
      groups.Older.push(conversation);
    }
  }

  return ["Today", "Yesterday", "Last 7 days", "Older"]
    .map((label) => ({
      label,
      conversations: groups[label] ?? [],
    }))
    .filter((group) => group.conversations.length > 0);
}

function startOfDayIst(now: Date): Date {
  const istOffsetMinutes = 5.5 * 60;
  const istNow = new Date(now.getTime() + istOffsetMinutes * 60 * 1000);
  const startUtc = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
  );

  return new Date(startUtc - istOffsetMinutes * 60 * 1000);
}
