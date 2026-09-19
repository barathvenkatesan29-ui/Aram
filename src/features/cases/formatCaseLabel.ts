function formatCaseTime(createdAtDate: Date): string {
  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(createdAtDate);

  return formattedTime.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}

export function formatCaseLabel(createdAt: string): string {
  const createdAtDate = new Date(createdAt);

  if (Number.isNaN(createdAtDate.getTime())) {
    return "Case";
  }

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(createdAtDate);

  return `Case · ${formattedDate} · ${formatCaseTime(createdAtDate)}`;
}
