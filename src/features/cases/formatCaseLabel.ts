export function formatCaseLabel(createdAt: string): string {
  const createdAtDate = new Date(createdAt);

  if (Number.isNaN(createdAtDate.getTime())) {
    return "Case";
  }

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(createdAtDate);

  return `Case · ${formattedDate}`;
}
