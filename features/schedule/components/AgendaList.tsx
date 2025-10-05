"use client";

import { useMemo } from "react";
import type { AvailabilityPattern, DayKey, TimeOffEntry } from "../lib/types";
import { DAY_LABELS, DAY_ORDER, convertHoursToRanges, formatHour } from "../lib/utils";

interface AgendaListProps {
  pattern: AvailabilityPattern;
  timeOff: TimeOffEntry[];
  timezone: string;
}

export default function AgendaList({ pattern, timeOff, timezone }: AgendaListProps) {
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }),
    [timezone]
  );

  const timeOffItems = timeOff.map((entry) => {
    const starts = formatter.format(new Date(entry.starts_at));
    const ends = formatter.format(new Date(entry.ends_at));
    return {
      id: entry.id,
      range: `${starts} → ${ends}`,
      reason: entry.reason?.trim() ?? "",
    };
  });

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#111629]">Upcoming time off</h2>
        {timeOffItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No time-off entries yet. Add time off to block specific dates.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {timeOffItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-[#111629]">{item.range}</p>
                {item.reason ? <p className="mt-1 text-sm text-slate-600">{item.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#111629]">Weekly pattern</h2>
        <p className="mt-1 text-sm text-slate-500">This summary reflects your recurring availability each week.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {DAY_ORDER.map((dayIndex) => {
            const dayKey = dayIndex.toString() as DayKey;
            const ranges = convertHoursToRanges(pattern[dayKey] ?? []);
            const summary = ranges
              .map((range) => `${formatHour(range.start)}–${formatHour(range.end)}`)
              .join(", ");
            return (
              <div key={dayKey} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <dt className="font-semibold text-[#111629]">{DAY_LABELS[dayKey]}</dt>
                <dd className="mt-1 text-slate-600">{summary || "—"}</dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}
