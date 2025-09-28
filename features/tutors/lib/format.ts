export function formatGBP(cents?: number | null): string {
  if (cents == null) return "—";
  const pounds = Math.round(cents / 100);
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(pounds);
  } catch {
    return `£${pounds}`;
  }
}

export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function formatLanguages(arr?: string[] | null): string {
  if (!arr || arr.length === 0) return "Languages not set";
  return arr.join(", ");
}

export function formatSubjects(arr?: string[] | null): string {
  if (!arr || arr.length === 0) return "No subjects listed";
  return arr.join(", ");
}
