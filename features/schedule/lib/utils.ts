import type { AvailabilityPattern, DayIndex, DayKey, TimeOffEntry } from "./types";

export const DAY_ORDER: DayIndex[] = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABELS: Record<DayKey, string> = {
  "0": "Sun",
  "1": "Mon",
  "2": "Tue",
  "3": "Wed",
  "4": "Thu",
  "5": "Fri",
  "6": "Sat",
};

export const DAY_FULL_LABELS: Record<DayKey, string> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
};

export function createEmptyPattern(): AvailabilityPattern {
  return {
    "0": [],
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
  };
}

export function clonePattern(pattern: AvailabilityPattern): AvailabilityPattern {
  return Object.fromEntries(
    Object.entries(pattern).map(([day, hours]) => [day, [...hours]])
  ) as AvailabilityPattern;
}

export function normalizePattern(pattern: AvailabilityPattern): AvailabilityPattern {
  const normalized: AvailabilityPattern = createEmptyPattern();
  (Object.keys(pattern) as DayKey[]).forEach((day) => {
    const hours = pattern[day]
      .map((h) => Number(h))
      .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
    const unique = Array.from(new Set(hours)).sort((a, b) => a - b);
    normalized[day] = unique;
  });
  return normalized;
}

export function patternsEqual(a: AvailabilityPattern, b: AvailabilityPattern): boolean {
  const aDays = Object.keys(a) as DayKey[];
  const bDays = Object.keys(b) as DayKey[];
  if (aDays.length !== bDays.length) return false;
  return aDays.every((day) => {
    const aVals = a[day];
    const bVals = b[day];
    if (!bVals || aVals.length !== bVals.length) return false;
    return aVals.every((hour, idx) => hour === bVals[idx]);
  });
}

export function formatHour(hour: number): string {
  const padded = hour.toString().padStart(2, "0");
  return `${padded}:00`;
}

export function convertHoursToRanges(hours: number[]): Array<{ start: number; end: number }> {
  if (!hours.length) return [];
  const sorted = [...hours].sort((a, b) => a - b);
  const ranges: Array<{ start: number; end: number }> = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const hour = sorted[i];
    if (hour === prev + 1) {
      prev = hour;
      continue;
    }
    ranges.push({ start: rangeStart, end: prev + 1 });
    rangeStart = hour;
    prev = hour;
  }
  ranges.push({ start: rangeStart, end: prev + 1 });
  return ranges;
}

export function patternSummary(pattern: AvailabilityPattern): Array<{ day: string; summary: string }>
{
  return DAY_ORDER.map((dayIndex) => {
    const dayKey = dayIndex.toString() as DayKey;
    const ranges = convertHoursToRanges(pattern[dayKey] ?? []);
    const summary = ranges
      .map((range) => `${formatHour(range.start)}–${formatHour(range.end)}`)
      .join(", ");
    return {
      day: DAY_LABELS[dayKey],
      summary: summary || "—",
    };
  });
}

export function sortTimeOff(entries: TimeOffEntry[]): TimeOffEntry[] {
  return [...entries].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

export function ensurePatternKeys(raw: Partial<Record<string, number[]>> | null | undefined): AvailabilityPattern {
  if (!raw) return createEmptyPattern();
  const pattern: AvailabilityPattern = createEmptyPattern();
  (Object.keys(raw) as string[]).forEach((key) => {
    if (key in pattern) {
      const dayKey = key as DayKey;
      const hours = Array.isArray(raw[dayKey]) ? (raw[dayKey] as number[]) : [];
      const cleaned = hours
        .map((h) => Number(h))
        .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
      pattern[dayKey] = Array.from(new Set(cleaned)).sort((a, b) => a - b);
    }
  });
  return pattern;
}

export function hoursSetFromPattern(pattern: AvailabilityPattern): Record<DayKey, Set<number>> {
  const map = {} as Record<DayKey, Set<number>>;
  (Object.keys(pattern) as DayKey[]).forEach((day) => {
    map[day] = new Set(pattern[day]);
  });
  return map;
}

export function patternFromHourSets(sets: Record<DayKey, Set<number>>): AvailabilityPattern {
  const pattern: AvailabilityPattern = createEmptyPattern();
  (Object.keys(sets) as DayKey[]).forEach((day) => {
    pattern[day] = Array.from(sets[day]).sort((a, b) => a - b);
  });
  return pattern;
}

export function minuteIso(date: Date): string {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.toISOString();
}
