export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DayKey = `${DayIndex}`;

export type AvailabilityPattern = Record<DayKey, number[]>;

export interface TimeOffEntry {
  id: string;
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface WeeklyGridChange {
  pattern: AvailabilityPattern;
  isDirty: boolean;
}
