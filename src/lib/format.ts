export function formatTime(date: Date, timeZone?: string) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}
