"use client";

import { useMemo, useState } from "react";

type SlotRow = {
  id: string;
  starts_at: string; // ISO
  ends_at: string | null; // ISO or null
  price_cents: number | null;
  status: string | null;
  held_by: string | null;
  hold_expires_at: string | null;
};

type Props = {
  slots: SlotRow[];
  refreshing?: boolean;
  onSelectSlot: (slotId: string) => void;
};

export default function AvailabilityGrid({ slots, refreshing, onSelectSlot }: Props) {
  const tf = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }),
    []
  );
  const df = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }),
    []
  );

  function startOfWeek(d: Date) {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // Monday as 0
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return date;
  }
  function addDays(d: Date, n: number) {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  }

  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const weekSlots = useMemo(
    () =>
      slots.filter((s) => {
        const sd = new Date(s.starts_at);
        return sd >= weekStart && sd < weekEnd;
      }),
    [slots, weekStart, weekEnd]
  );

  const groupedByDay = useMemo(() => {
    const buckets: SlotRow[][] = Array.from({ length: 7 }, () => []);
    for (const s of weekSlots) {
      const idx = (new Date(s.starts_at).getDay() + 6) % 7; // Mon=0
      buckets[idx].push(s);
    }
    buckets.forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      )
    );
    return buckets;
  }, [weekSlots]);

  const weekLabel = `${df.format(weekStart)} – ${df.format(addDays(weekStart, 6))}`;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-[#CDD5E0]">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="px-3 py-2 text-sm hover:bg-[#F7F8FA]"
            aria-label="Previous week"
          >
            ‹
          </button>
          <div className="border-l border-r border-[#CDD5E0] px-3 py-2 text-sm font-medium">
            {weekLabel}
          </div>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="px-3 py-2 text-sm hover:bg-[#F7F8FA]"
            aria-label="Next week"
          >
            ›
          </button>
        </div>

        <span className="text-xs text-gray-500">Times shown in your local timezone</span>
      </div>

      {refreshing && (
        <div className="mt-1 text-right text-xs text-gray-500">Updating availability…</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => {
          const dayDate = addDays(weekStart, i);
          const dayLabel = dayDate.toLocaleDateString(undefined, {
            weekday: "short",
          });
          const dateNum = dayDate.getDate();
          const daySlots = groupedByDay[i];

          return (
            <div key={i} className="rounded-xl border border-[#CDD5E0] bg-white p-3">
              <div className="mb-2 flex items-end justify-between">
                <div className="font-medium">{dayLabel}</div>
                <div className="text-xs text-gray-500">{dateNum}</div>
              </div>

              {daySlots.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">—</div>
              ) : (
                <ul className="space-y-2">
                  {daySlots.map((s) => {
                    const now = Date.now();
                    const isHeld =
                      s.status !== "available" ||
                      (s.hold_expires_at
                        ? new Date(s.hold_expires_at).getTime() > now
                        : false);
                    const start = tf.format(new Date(s.starts_at));
                    const price =
                      s.price_cents != null
                        ? `£${(s.price_cents / 100).toFixed(0)}`
                        : "£—";
                    const label =
                      s.status === "booked"
                        ? "Booked"
                        : s.status === "held"
                        ? "Held"
                        : isHeld
                        ? "Unavailable"
                        : "Select";

                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => onSelectSlot(s.id)}
                          disabled={isHeld}
                          className={[
                            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm shadow-sm ring-1 transition",
                            isHeld
                              ? "cursor-not-allowed bg-gray-100 text-gray-500 ring-gray-200"
                              : "bg-white ring-[#CDD5E0] hover:bg-[#F7D250] hover:text-[#111629]",
                          ].join(" ")}
                          title={`${new Date(s.starts_at).toLocaleString()} → ${new Date(
                            s.ends_at ?? s.starts_at
                          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        >
                          <span className="tabular-nums">{start}</span>
                          <span
                            className={[
                              "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ring-1",
                              isHeld
                                ? "bg-[#CDD5E0] text-[#111629] ring-[#CDD5E0]"
                                : "bg-[#F7D250] text-[#111629] ring-[#CDD5E0]",
                            ].join(" ")}
                          >
                            {label}
                          </span>
                          <span className="text-xs text-gray-500">{price}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center">
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-md border border-[#CDD5E0] px-3 py-1.5 text-sm text-[#111629] hover:bg-[#F7D250]"
        >
          Back to this week
        </button>
      </div>
    </div>
  );
}

