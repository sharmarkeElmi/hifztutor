"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@components/ui/button";
import WeeklyGrid from "@features/schedule/components/WeeklyGrid";
import TimeOffModal from "@features/schedule/components/TimeOffModal";
import type { AvailabilityPattern } from "@features/schedule/lib/types";
import {
  createEmptyPattern,
  ensurePatternKeys,
  normalizePattern,
  patternsEqual,
  formatHour,
} from "@features/schedule/lib/utils";

type SlotRow = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: "available" | "held" | "booked" | "canceled";
  hold_expires_at?: string | null;
};

type SlotViewRow = SlotRow & {
  student_name?: string | null;
  student_avatar?: string | null;
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const offset = (day + 6) % 7; // Monday as start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedDateToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const assumedUtc = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(assumedUtc);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    values[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    values.year,
    (values.month ?? 1) - 1,
    values.day ?? 1,
    values.hour ?? 0,
    values.minute ?? 0,
    values.second ?? 0
  );
  const offset = asUtc - assumedUtc.getTime();
  return new Date(assumedUtc.getTime() - offset);
}

export default function TutorSchedulePage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [savedPattern, setSavedPattern] = useState<AvailabilityPattern>(createEmptyPattern());
  const [draftPattern, setDraftPattern] = useState<AvailabilityPattern>(createEmptyPattern());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [panelMode, setPanelMode] = useState<"status" | "edit">("status");

  const [slots, setSlots] = useState<SlotViewRow[]>([]);
  const [slotLoading, setSlotLoading] = useState(true);
  const [bookedDetails, setBookedDetails] = useState<Record<string, { studentName?: string; studentAvatar?: string }>>({});
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const sectionRef = useRef<HTMLDivElement | null>(null);

  const redirectToSignIn = useCallback(() => {
    const next = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
    window.location.replace(next ? `/signin?next=${encodeURIComponent(next)}` : "/signin");
  }, []);


  const loadSlots = useCallback(
    async (uid: string) => {
      setSlotLoading(true);
      // Compute the current visible week window [weekStart-1d, weekStart+8d) to avoid TZ edge misses
      const localWeekStart = new Date(weekStart);
      localWeekStart.setHours(0, 0, 0, 0);
      const paddedStart = addDays(localWeekStart, -1);
      const paddedEnd = addDays(localWeekStart, 8);

      const { data: slotData, error: slotErr } = await supabase
        .from("lesson_slots")
        .select("id, starts_at, ends_at, status, hold_expires_at")
        .eq("tutor_id", uid)
        .gte("starts_at", paddedStart.toISOString())
        .lt("starts_at", paddedEnd.toISOString())
        .order("starts_at", { ascending: true });

      if (!slotErr) {
        let rows: SlotViewRow[] = (slotData ?? []).map((row) => {
          const normalizedStatus = ((): SlotRow["status"] => {
            const raw = (row.status ?? "available").toString().toLowerCase();
            if (raw === "open") return "available";
            if (raw === "completed" || raw === "confirmed") return "booked";
            if (raw === "canceled" || raw === "archived" || raw === "released") return "available";
            if (raw === "held") return "held";
            if (raw === "booked") return "booked";
            return "available";
          })();

          return {
            id: row.id,
            starts_at: row.starts_at,
            ends_at: row.ends_at ?? null,
            status: normalizedStatus,
            hold_expires_at: row.hold_expires_at ?? null,
          } satisfies SlotViewRow;
        });

        const bookedSlotIds = rows.filter((row) => row.status === "booked" && row.id).map((row) => row.id);

        let detailMap: Record<string, { studentName?: string; studentAvatar?: string }> = {};
        if (bookedSlotIds.length) {
          const { data: bookingRows, error: bookingsErr } = await supabase
            .from("bookings")
            .select("id, slot_id, student_id, status")
            .in("slot_id", bookedSlotIds);

          if (!bookingsErr && bookingRows?.length) {
            const activeBookings = bookingRows.filter((booking) => booking.status?.toLowerCase() !== "canceled");
            const studentIds = Array.from(new Set(activeBookings.map((booking) => booking.student_id).filter(Boolean)));

            let studentMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
            if (studentIds.length) {
              const { data: studentRows, error: studentErr } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .in("id", studentIds);

              if (!studentErr && studentRows) {
                studentMap = Object.fromEntries(
                  studentRows.map((student) => [student.id, { full_name: student.full_name ?? null, avatar_url: student.avatar_url ?? null }])
                );
              }
            }

            detailMap = activeBookings.reduce<Record<string, { studentName?: string; studentAvatar?: string }>>((acc, booking) => {
              if (!booking.slot_id || acc[booking.slot_id]) return acc;
              const profile = booking.student_id ? studentMap[booking.student_id] : undefined;
              acc[booking.slot_id] = {
                studentName: profile?.full_name ?? undefined,
                studentAvatar: profile?.avatar_url ?? undefined,
              };
              return acc;
            }, {});

            rows = rows.map((row) => {
              if (row.status !== "booked" || !row.id) return row;
              const detail = detailMap[row.id];
              if (!detail) return row;
              return {
                ...row,
                student_name: detail.studentName ?? null,
                student_avatar: detail.studentAvatar ?? null,
              } satisfies SlotViewRow;
            });
          }
        }

        setSlots(rows);
        setBookedDetails(detailMap);
        setError(null);
      } else {
        console.error("loadSlots error:", slotErr);
        setSlots([]);
        setBookedDetails({});
        // Optional surface-level status to help diagnose blank status grid
        setStatus(null);
        setError(`Could not load weekly status: ${slotErr.message}`);
      }

      setSlotLoading(false);
    },
    [supabase, weekStart]
  );

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw new Error(userError.message);
      }
      const user = userData?.user;
      if (!user) {
        redirectToSignIn();
        return;
      }
      const uid = user.id;
      setUserId(uid);

      const [{ data: patternRow, error: patternError }, { data: tutorProfileRow }, { data: profileRow } ] = await Promise.all([
        supabase
          .from("tutor_availability_patterns")
          .select("tutor_id, timezone, hours_by_dow")
          .eq("tutor_id", uid)
          .maybeSingle(),
        supabase
          .from("tutor_profiles")
          .select("time_zone")
          .eq("tutor_id", uid)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("timezone")
          .eq("id", uid)
          .maybeSingle(),
      ]);

      if (patternError) {
        throw new Error(patternError.message);
      }

      const derivedTimezone = profileRow?.timezone || patternRow?.timezone || tutorProfileRow?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(derivedTimezone);

      const normalizedPattern = patternRow?.hours_by_dow
        ? normalizePattern(ensurePatternKeys(patternRow.hours_by_dow as Record<string, number[]>))
        : createEmptyPattern();

      setSavedPattern(normalizedPattern);
      setDraftPattern(normalizedPattern);
      setUnsaved(false);
      await loadSlots(uid);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadSlots, redirectToSignIn, supabase]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (userId) {
      loadSlots(userId);
    }
  }, [userId, weekStart, loadSlots]);

  const handlePatternChange = useCallback(
    (pattern: AvailabilityPattern, dirty: boolean) => {
      setDraftPattern(pattern);
      setUnsaved(dirty);
      if (dirty) {
        setStatus(null);
      }
    },
    []
  );

  const syncLessonSlots = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/tutor/schedule/sync", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const text = await res.text();
      const body = text ? (JSON.parse(text) as { created?: number; error?: string }) : {};
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to publish booking slots");
      }
      if (typeof body.created === "number" && body.created > 0) {
        return `Availability saved. Published ${body.created} new slot${body.created === 1 ? "" : "s"}.`;
      }
      return "Availability saved.";
    } catch (error) {
      console.error(error);
      return "Availability saved, but we couldn’t refresh booking slots. Please try again.";
    }
  }, [supabase]);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const payload = {
        tutor_id: userId,
        timezone,
        hours_by_dow: draftPattern,
      };
      const { error: upsertError } = await supabase
        .from("tutor_availability_patterns")
        .upsert(payload, { onConflict: "tutor_id" });
      if (upsertError) {
        throw new Error(upsertError.message);
      }
      setSavedPattern(draftPattern);
      setUnsaved(false);
      const syncMessage = await syncLessonSlots();
      await loadSlots(userId);
      setStatus(syncMessage ?? "Availability saved");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [draftPattern, loadSlots, supabase, syncLessonSlots, timezone, userId]);

  const handleCreateTimeOff = useCallback(
    async ({ start, end, reason }: { start: Date; end: Date; reason: string }) => {
      if (!userId) throw new Error("You must be signed in.");
      const { error: insertError } = await supabase.from("tutor_time_off").insert({
        tutor_id: userId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        reason: reason || null,
      });
      if (insertError) {
        throw new Error(insertError.message);
      }
      setStatus("Time off added.");
      setModalOpen(false);
    },
    [supabase, userId]
  );

  const dirtySinceSave = useMemo(() => !patternsEqual(savedPattern, draftPattern), [draftPattern, savedPattern]);

  const showSave = unsaved || dirtySinceSave;

  const localTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const displayTimezone = timezone || localTimezone;

  const dayLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: displayTimezone }),
    [displayTimezone]
  );

  const datePartsFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: displayTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [displayTimezone]
  );
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { timeZone: displayTimezone, weekday: "short" }),
    [displayTimezone]
  );

  const getTzInfo = useCallback(
    (value: Date | string) => {
      const dateObj = typeof value === "string" ? new Date(value) : value;
      const parts = datePartsFormatter.formatToParts(dateObj);
      const part = (type: Intl.DateTimeFormatPart["type"]) => parts.find((p) => p.type === type)?.value ?? "";
      const year = Number(part("year"));
      const month = Number(part("month"));
      const day = Number(part("day"));
      const hour = Number(part("hour"));
      const minute = Number(part("minute"));
      const dateKey = `${part("year")}-${part("month")}-${part("day")}`;
      const weekdayLabel = weekdayFormatter.format(dateObj).slice(0, 3);
      const weekdayIndex = WEEKDAY_TO_INDEX[weekdayLabel] ?? new Date(dateObj).getDay();
      return {
        year,
        month,
        day,
        hour,
        minute,
        dateKey,
        weekdayIndex,
      };
    },
    [datePartsFormatter, weekdayFormatter]
  );

  const weekDayInfos = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const baseDate = addDays(weekStart, idx);
      const info = getTzInfo(baseDate);
      return {
        ...info,
        baseDate,
        zonedStart: zonedDateToUtc(info.year, info.month, info.day, 0, displayTimezone),
      };
    });
  }, [displayTimezone, getTzInfo, weekStart]);

  const [weekLabel, setWeekLabel] = useState<string>("");
  useEffect(() => {
    if (!weekDayInfos.length) return;
    const first = weekDayInfos[0];
    const last = weekDayInfos[weekDayInfos.length - 1];
    const startLabel = new Date(first.zonedStart).toLocaleDateString("en-GB", {
      timeZone: displayTimezone,
      month: "short",
      day: "numeric",
    });
    const endLabel = new Date(last.zonedStart).toLocaleDateString("en-GB", {
      timeZone: displayTimezone,
      month: "short",
      day: "numeric",
    });
    setWeekLabel(`${startLabel} – ${endLabel}, ${new Date(last.zonedStart).getFullYear()}`);
  }, [displayTimezone, weekDayInfos]);

  const dayKeyToIndex = useMemo(() => {
    const map = new Map<string, number>();
    weekDayInfos.forEach((info, idx) => {
      map.set(info.dateKey, idx);
    });
    return map;
  }, [weekDayInfos]);

  const slotsByDay = useMemo(() => {
    const buckets: SlotRow[][] = Array.from({ length: 7 }, () => []);
    slots.forEach((slot) => {
      const info = getTzInfo(slot.starts_at);
      const index = dayKeyToIndex.get(info.dateKey);
      if (index === undefined) return;
      buckets[index].push(slot);
    });
    buckets.forEach((list) => list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));
    return buckets;
  }, [dayKeyToIndex, getTzInfo, slots]);

  const todayInfo = useMemo(() => getTzInfo(new Date()), [getTzInfo]);

  const hasSlotsThisWeek = useMemo(() => slotsByDay.some((list) => list.length > 0), [slotsByDay]);

  const statusByCell = useMemo(() => {
    const now = Date.now();
    const patternHoursByDay = weekDayInfos.map((info) => {
      if (!info) return new Set<number>();
      const dayKey = info.weekdayIndex.toString() as keyof AvailabilityPattern;
      return new Set(savedPattern[dayKey] ?? []);
    });

    return weekDayInfos.map((dayInfo, dayIndex) => {
      const map: Record<number, { status: SlotRow["status"]; label: string; avatar?: string }> = {};
      const patternHours = new Set(patternHoursByDay[dayIndex] ?? []);

      const daySlots = slotsByDay[dayIndex] ?? [];
      daySlots.forEach((slot) => {
        const tzInfo = getTzInfo(slot.starts_at);
        const hour = tzInfo.hour;
        const inPattern = patternHours.has(hour);
        const normalizedStatus: SlotRow["status"] = (() => {
          const raw = (slot.status ?? "available").toString().toLowerCase();
          if (raw === "completed" || raw === "confirmed") return "booked";
          if (raw === "canceled" || raw === "released" || raw === "archived") return "available";
          if (raw === "held") return "held";
          if (raw === "booked") return "booked";
          return "available";
        })();

        let label = "";
        let avatar: string | undefined;
        const slotTime = new Date(slot.starts_at).getTime();

        if (normalizedStatus === "booked") {
          const detail = bookedDetails[slot.id];
          label = detail?.studentName ? `Booked · ${detail.studentName}` : "Booked";
          avatar = detail?.studentAvatar ?? undefined;
        } else if (normalizedStatus === "held") {
          if (slot.hold_expires_at) {
            const expires = new Date(slot.hold_expires_at);
            if (expires.getTime() > now) {
              label = `Held until ${expires.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
            } else {
              label = "Unavailable";
            }
          }
        } else {
          const isPast = slotTime < now;
          if (inPattern) {
            if (isPast) label = "Unavailable";
          } else if (normalizedStatus === "available") {
            patternHours.delete(hour);
            return;
          }
        }

        map[hour] = { status: normalizedStatus, label, avatar };
        patternHours.delete(hour);
      });

      if (dayInfo) {
        patternHours.forEach((hour) => {
          const slotUtc = zonedDateToUtc(dayInfo.year, dayInfo.month, dayInfo.day, hour, displayTimezone);
          if (slotUtc.getTime() >= now) return;
          if (!map[hour]) {
            map[hour] = { status: "available", label: "Unavailable" };
          }
        });
      }

      return map;
    });
  }, [bookedDetails, displayTimezone, getTzInfo, savedPattern, slotsByDay, weekDayInfos]);

  useEffect(() => {
    if (panelMode === "edit") {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }, [panelMode]);

  return (
    <div className="w-full space-y-8 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setModalOpen(true)}>Add time off</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-emerald-300 bg-emerald-100" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-200" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-rose-300 bg-rose-100" />
            <span>Booked</span>
          </div>
        </div>
      </header>

      {status && panelMode === "status" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </div>
      ) : null}
      {error && panelMode === "status" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      <section ref={sectionRef} className="rounded-2xl border border-[#CDD5E0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: week navigation + label */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#02667C] hover:bg-[#E5F6F8]"
              aria-label="Previous week"
            >
              ‹
            </button>
            <div className="text-sm font-semibold text-[#111629]">{weekLabel}</div>
            <button
              type="button"
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#02667C] hover:bg-[#E5F6F8]"
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          {/* Right: timezone, back-to-week, and compact mode toggle */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="hidden sm:inline">Times shown in {displayTimezone}</span>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 font-semibold text-[#02667C] hover:bg-[#E5F6F8]"
            >
              Back to this week
            </button>
            <div className="ml-1 inline-flex h-8 items-center overflow-hidden rounded-full border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setPanelMode("status")}
                className={`${panelMode === "status" ? "bg-[#D3F501] text-[#111629]" : "text-slate-600 hover:bg-slate-50"} h-full px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]`}
                aria-pressed={panelMode === "status"}
              >
                Weekly status
              </button>
              <button
                type="button"
                onClick={() => setPanelMode("edit")}
                className={`${panelMode === "edit" ? "bg-[#D3F501] text-[#111629]" : "text-slate-600 hover:bg-slate-50"} h-full px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]`}
                aria-pressed={panelMode === "edit"}
              >
                Set availability
              </button>
            </div>
          </div>
        </div>

        {/* STATUS MODE: summary heatmap */}
        {panelMode === "status" ? (
          <>
            {slotLoading ? (
              <div className="mt-6 text-sm text-slate-500">Loading slots…</div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <div className="min-w-[980px] rounded-3xl border border-slate-200 bg-white/90 backdrop-blur">
                  <div
                    className="relative grid text-sm"
                    style={{ gridTemplateColumns: "120px repeat(7, minmax(0, 1fr))" }}
                  >
                    {/* Header row */}
                    <div className="sticky left-0 top-0 z-20 bg-gradient-to-br from-white via-white to-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 shadow-[1px_0_0_rgba(148,163,184,0.35)]">
                      Time
                    </div>
                    {Array.from({ length: 7 }).map((_, index) => {
                      const dayInfo = weekDayInfos[index];
                      const weekend = dayInfo ? dayInfo.weekdayIndex === 0 || dayInfo.weekdayIndex === 6 : false;
                      const isToday = dayInfo ? dayInfo.dateKey === todayInfo.dateKey : false;
                      return (
                        <div
                          key={`header-${index}`}
                          className={`sticky top-0 z-10 border-l border-slate-200 px-3 py-3 text-center font-semibold transition-colors ${
                            isToday
                              ? "bg-[#F7FFB0] text-[#111629] shadow-[0_2px_0_rgba(211,245,1,0.45)]"
                              : "bg-white text-[#02667C]"
                          } ${weekend && !isToday ? "bg-slate-50" : ""}`}
                        >
                          <div className="uppercase tracking-[0.15em] text-xs text-slate-500">
                            {dayInfo ? dayLabelFormatter.format(new Date(dayInfo.zonedStart)) : ""}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-700">
                            {dayInfo ? dayInfo.day : ""}
                          </div>
                        </div>
                      );
                    })}

                    {/* Body rows */}
                    {HOURS.map((hour) => (
                      <Fragment key={hour}>
                        {/* Sticky time column */}
                        <div className="sticky left-0 z-10 border-t border-slate-100 bg-gradient-to-r from-white via-white to-slate-50 px-4 py-2 text-sm font-medium text-slate-500 shadow-[1px_0_0_rgba(148,163,184,0.35)]">
                          {formatHour(hour)}
                        </div>
                        {Array.from({ length: 7 }).map((_, index) => {
                          const dayInfo = weekDayInfos[index];
                          const isToday = dayInfo ? dayInfo.dateKey === todayInfo.dateKey : false;
                          const weekend = dayInfo ? dayInfo.weekdayIndex === 0 || dayInfo.weekdayIndex === 6 : false;

                          const cellInfo = statusByCell[index]?.[hour] ?? null;
                          const status = cellInfo?.status ?? null;
                          const label = cellInfo?.label ?? "";
                          const avatar = cellInfo?.avatar;
                          const isUnavailable = status === "available" && label === "Unavailable";
                          const baseBg =
                            status === "booked"
                              ? "bg-rose-100/80"
                              : status === "available"
                                ? isUnavailable
                                  ? "bg-slate-200"
                                  : "bg-emerald-100/80"
                                : weekend
                                ? "bg-slate-50"
                                : "bg-white";

                          const ringToday = isToday ? "ring-1 ring-[#D3F501]" : "";

                          const title = status ? `${formatHour(hour)} ${label || status}` : undefined;

                          return (
                            <div
                              key={`${index}-${hour}`}
                              className={`group border-t border-l border-slate-200 px-2 py-3 text-xs transition-all duration-150 ${baseBg} ${ringToday} hover:-translate-y-[1px] hover:bg-slate-50/80`}
                              title={title}
                              aria-label={title}
                            >
                              {avatar ? (
                                <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={avatar}
                                    alt={label || "Booked student"}
                                    className="h-8 w-8 rounded-full object-cover shadow-sm ring-1 ring-white/70"
                                  />
                                </span>
                              ) : null}
                              {label ? (
                                <span className="block text-[11px] font-semibold leading-tight text-[#02667C]">
                                  {label}
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!slotLoading && !hasSlotsThisWeek ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No upcoming slots this week. Try navigating to another week or check back soon.
              </div>
            ) : null}
          </>
        ) : null}

        {/* EDIT MODE: recurring grid editor */}
        {panelMode === "edit" ? (
          <>
            <div className="mt-6 flex flex-col items-start gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recurring timezone: {timezone}
              </span>
            </div>

            {status ? (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {status}
              </div>
            ) : null}
            {error ? (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Loading availability…
              </div>
            ) : (
              <WeeklyGrid
                pattern={draftPattern}
                baseline={savedPattern}
                onChange={handlePatternChange}
              />
            )}
          </>
        ) : null}
      </section>
      {showSave ? (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/95 px-4 py-4 shadow-[0_-10px_30px_rgba(17,22,41,0.15)] sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="text-sm text-slate-600">You have unsaved availability changes.</div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}

      <TimeOffModal
        open={modalOpen}
        timezone={timezone}
        onCancel={() => setModalOpen(false)}
        onCreate={handleCreateTimeOff}
      />
    </div>
  );
}
