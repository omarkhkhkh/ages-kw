// Kuwait timezone utility — Asia/Kuwait (UTC+3, no DST)
const KUWAIT_TZ = "Asia/Kuwait";

/**
 * Format a date string or Date object to Kuwait local time.
 */
export function formatKuwaitDate(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-KW", { ...opts, timeZone: KUWAIT_TZ }).format(d);
}

/**
 * Format a date+time to Kuwait local time.
 */
export function formatKuwaitDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-KW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: KUWAIT_TZ,
  }).format(d);
}

/**
 * Get current Kuwait time as ISO string.
 */
export function nowKuwait(): Date {
  const now = new Date();
  // Kuwait is UTC+3
  return new Date(now.toLocaleString("en-US", { timeZone: KUWAIT_TZ }));
}

/**
 * Get today's date in Kuwait as YYYY-MM-DD string.
 */
export function todayKuwait(): string {
  const d = nowKuwait();
  return d.toISOString().split("T")[0];
}

/**
 * Get a human-friendly relative time string in Arabic (Kuwait tz).
 */
export function formatRelativeKuwait(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "غداً";
  if (diffDays === -1) return "أمس";
  if (diffDays > 0) return `بعد ${diffDays} يوم`;
  return `منذ ${Math.abs(diffDays)} يوم`;
}
