"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { AvailabilityPattern, DayKey } from "../lib/types";
import { DAY_ORDER, DAY_LABELS, DAY_FULL_LABELS, normalizePattern, patternsEqual } from "../lib/utils";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

interface WeeklyGridProps {
  pattern: AvailabilityPattern;
  baseline: AvailabilityPattern;
  onChange?: (pattern: AvailabilityPattern, isDirty: boolean) => void;
}

export default function WeeklyGrid({ pattern, baseline, onChange }: WeeklyGridProps) {
  const normalizedBaseline = useMemo(() => normalizePattern(baseline), [baseline]);
  const normalizedPattern = useMemo(() => normalizePattern(pattern), [pattern]);

  const baselineRef = useRef<AvailabilityPattern>(normalizedBaseline);
  const [localPattern, setLocalPattern] = useState<AvailabilityPattern>(normalizedPattern);

  const skipNotifyRef = useRef(true);
  const externalUpdateRef = useRef(false);

  useEffect(() => {
    baselineRef.current = normalizedBaseline;
  }, [normalizedBaseline]);

  useEffect(() => {
    externalUpdateRef.current = true;
    setLocalPattern(normalizedPattern);
  }, [normalizedPattern]);

  useEffect(() => {
    if (skipNotifyRef.current || externalUpdateRef.current) {
      skipNotifyRef.current = false;
      externalUpdateRef.current = false;
      return;
    }
    const dirty = !patternsEqual(localPattern, baselineRef.current);
    onChange?.(localPattern, dirty);
  }, [localPattern, onChange]);

  const dragState = useRef<{ active: boolean; setTo: boolean }>({ active: false, setTo: true });

  useEffect(() => {
    const handlePointerUp = () => {
      dragState.current = { active: false, setTo: true };
    };
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  const toggleCell = (dayKey: DayKey, hour: number, makeAvailable: boolean) => {
    setLocalPattern((prev) => {
      const currentSet = new Set(prev[dayKey]);
      if (makeAvailable) {
        currentSet.add(hour);
      } else {
        currentSet.delete(hour);
      }
      const nextDay = Array.from(currentSet).sort((a, b) => a - b);
      return { ...prev, [dayKey]: nextDay } as AvailabilityPattern;
    });
  };

  const handlePointerDown = (dayKey: DayKey, hour: number, currentValue: boolean, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const nextValue = !currentValue;
    dragState.current = { active: true, setTo: nextValue };
    toggleCell(dayKey, hour, nextValue);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerEnter = (dayKey: DayKey, hour: number) => {
    if (!dragState.current.active) return;
    toggleCell(dayKey, hour, dragState.current.setTo);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div
          className="w-full min-w-[720px] rounded-2xl border border-slate-200 bg-white"
          style={{ boxShadow: "0 15px 35px -20px rgba(17,22,41,0.25)" }}
        >
          <div
            className="grid text-sm"
            style={{ gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))" }}
          >
            <div className="sticky top-0 z-10 bg-white px-3 py-3 font-semibold text-slate-500">Time</div>
            {DAY_ORDER.map((dayIndex) => {
              const dayKey = dayIndex.toString() as DayKey;
              return (
                <div
                  key={dayKey}
                  className="sticky top-0 z-10 border-l border-slate-200 bg-white px-3 py-3 text-center font-semibold text-[#111629]"
                >
                  {DAY_LABELS[dayKey]}
                </div>
              );
            })}
            {HOURS.map((hour) => (
              <Fragment key={hour}>
                <div
                  className="border-t border-slate-100 px-3 py-2 text-sm font-medium text-slate-500"
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {DAY_ORDER.map((dayIndex) => {
                  const dayKey = dayIndex.toString() as DayKey;
                  const available = (localPattern[dayKey] ?? []).includes(hour);
                  return (
                    <button
                      key={`${dayKey}-${hour}`}
                      type="button"
                      onPointerDown={(event) => handlePointerDown(dayKey, hour, available, event)}
                      onPointerEnter={() => handlePointerEnter(dayKey, hour)}
                      className={`border-t border-l px-1 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] focus-visible:ring-offset-0 ${
                        available
                          ? "bg-[#D3F501] text-[#111629] font-semibold"
                          : "bg-slate-50 text-slate-400"
                      }`}
                      aria-pressed={available}
                      aria-label={`${DAY_FULL_LABELS[dayKey]} ${hour.toString().padStart(2, "0")}:00 ${
                        available ? "available" : "unavailable"
                      }`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#D3F501] border border-black" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-200 border border-slate-300" />
          <span>Unavailable</span>
        </div>
        <span className="text-xs text-slate-400">Tip: click and drag to apply to multiple cells.</span>
      </div>
    </div>
  );
}
