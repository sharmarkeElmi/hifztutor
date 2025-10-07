"use client";

/**
 * Shared Tutor Profile UI
 * Reused by public and dashboard-scoped routes.
 * Does not render public Footer; parent decides the chrome.
 */

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import SlotHoldModal from "@features/booking/components/SlotHoldModal";
import type { AvailabilityPattern, DayKey } from "@features/schedule/lib/types";
import { ensurePatternKeys, convertHoursToRanges, formatHour, DAY_FULL_LABELS, DAY_ORDER } from "@features/schedule/lib/utils";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

type ProfileRow = {
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
};

type TutorProfileRow = {
  tutor_id: string;
  headline: string | null;
  bio: string | null;
  languages: string[] | null;
  hourly_rate_cents: number | null;
  country_code: string | null;
  years_experience: number | null;
  photo_url: string | null;
  time_zone?: string | null;
};

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
  tutorId: string;
  /** Base path for internal profile-related links like "Back to tutors". */
  basePath?: "/tutors" | "/student/tutors";
};

export default function TutorProfile({ tutorId, basePath = "/tutors" }: Props) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tutor, setTutor] = useState<TutorProfileRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [holdOpen, setHoldOpen] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pattern, setPattern] = useState<AvailabilityPattern | null>(null);
  const [patternTimezone, setPatternTimezone] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const initialWeekSet = useRef(false);

  const [authed, setAuthed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tutorId) return;
      setLoading(true);
      setError(null);
      setNotFound(false);

      // 1) Base profile
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("full_name, role, avatar_url")
        .eq("id", tutorId)
        .maybeSingle();

      if (pErr) {
        if (!cancelled) {
          setError(pErr.message);
          setLoading(false);
        }
        return;
      }

      if (!p || p.role !== "tutor") {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      // 2) Tutor extras
      const { data: t, error: tErr } = await supabase
        .from("tutor_profiles")
        .select(
          "tutor_id, headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url, time_zone"
        )
        .eq("tutor_id", tutorId)
        .maybeSingle();

      if (tErr) {
        if (!cancelled) {
          setError(tErr.message);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setProfile(p);
        setTutor(t ?? null);

        try {
          const res = await fetch(`/api/tutors/${tutorId}/availability-pattern`, { cache: "no-store" });
          if (!cancelled) {
            if (res.ok) {
              const body = (await res.json()) as {
                hours_by_dow: Record<string, number[]> | null;
                timezone: string | null;
              };
              if (body.hours_by_dow) {
                setPattern(ensurePatternKeys(body.hours_by_dow));
                setPatternTimezone(body.timezone ?? t?.time_zone ?? null);
              } else {
                setPattern(null);
                setPatternTimezone(body.timezone ?? t?.time_zone ?? null);
              }
            } else {
              setPattern(null);
              setPatternTimezone(t?.time_zone ?? null);
            }
          }
        } catch {
          if (!cancelled) {
            setPattern(null);
            setPatternTimezone(t?.time_zone ?? null);
          }
        }

        // Availability slots (available only, next 20 future)
        const { data: s, error: sErr } = await supabase
          .from("lesson_slots")
          .select(
            "id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at"
          )
          .eq("tutor_id", tutorId)
          .eq("status", "available")
          .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(21 * 24);

        if (sErr) {
          if (!cancelled) setSlots([]);
        } else if (!cancelled) {
          setSlots(s ?? []);
        }

        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tutorId, supabase]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthed(!!session);
    });
    return () => {
      active = false;
      sub.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  const nextParam = useMemo(() => {
    const qs = searchParams?.toString();
    const path = pathname || "/";
    return encodeURIComponent(qs ? `${path}?${qs}` : path);
  }, [pathname, searchParams]);

  async function refreshSlots() {
    if (!tutorId) return;
    setRefreshing(true);
    const { data, error } = await supabase
      .from("lesson_slots")
      .select(
        "id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at"
      )
      .eq("tutor_id", tutorId)
      .eq("status", "available")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(21 * 24);
    if (!error) setSlots(data ?? []);
    setRefreshing(false);
  }

  useEffect(() => {
    if (initialWeekSet.current) return;
    if (!slots.length) return;
    initialWeekSet.current = true;
    setWeekStart(startOfWeek(new Date(slots[0].starts_at)));
  }, [slots]);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }), []);
  const dayLabelFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "short" }), []);
  const dateLabelFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }), []);
  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const startLabel = dateLabelFormatter.format(weekStart);
    const endLabel = dateLabelFormatter.format(end);
    const year = end.getFullYear();
    return `${startLabel} – ${endLabel}, ${year}`;
  }, [weekStart, dateLabelFormatter]);
  const localTimezone = useMemo(() => patternTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, [patternTimezone]);

  const slotsByDay = useMemo(() => {
    const buckets: SlotRow[][] = Array.from({ length: 7 }, () => []);
    slots.forEach((slot) => {
      const start = new Date(slot.starts_at);
      if (start < weekStart || start >= weekEnd) return;
      const dayIndex = Math.floor((startOfDay(start).getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex >= 7) return;
      buckets[dayIndex].push(slot);
    });
    buckets.forEach((list) =>
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    );
    return buckets;
  }, [slots, weekStart, weekEnd]);

  const hasSlotsThisWeek = useMemo(() => slotsByDay.some((d) => d.length > 0), [slotsByDay]);

  function onPickSlot(slotId: string) {
    setActiveSlotId(slotId);
    setHoldOpen(true);
  }

  function handleModalClose() {
    setHoldOpen(false);
    setActiveSlotId(null);
    void refreshSlots();
  }

  const displayName = profile?.full_name ?? "Hifz Tutor";
  const headline = tutor?.headline ?? "Qur’an / Hifz tutor";
  const bio = tutor?.bio ?? "This tutor hasn’t added a bio yet.";
  const languages = tutor?.languages ?? [];
  const rate = tutor?.hourly_rate_cents != null
    ? (tutor.hourly_rate_cents / 100).toFixed(0)
    : null;
  const years = tutor?.years_experience ?? null;
  const country = (tutor?.country_code ?? "").toUpperCase();
  const photoUrl = tutor?.photo_url || profile?.avatar_url || "/vercel.svg";

  function CountryBadge({ code }: { code?: string | null }) {
    if (!code) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700">
        <span className="opacity-70">{flagEmoji(code)}</span>
        {code}
      </span>
    );
  }
  function flagEmoji(code: string) {
    if (!code || code.length !== 2) return "🏳️";
    const base = 127397;
    const chars = code
      .toUpperCase()
      .split("")
      .map((c) => base + c.charCodeAt(0));
    return String.fromCodePoint(...chars);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading tutor…
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-semibold">Tutor not found</h1>
        <p className="mt-1 text-muted-foreground">
          This profile doesn’t exist or isn’t public.
        </p>
        <div className="mt-4">
          <Link href={basePath} className="text-emerald-700 hover:underline">
            Back to tutors
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header / Hero */}
      <section className="rounded-2xl border border-[#CDD5E0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          {/* Photo */}
          <div className="relative overflow-hidden rounded-2xl ring-4 ring-[#F7F8FA] h-[180px] w-full md:h-[200px] md:w-[220px] md:flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
          </div>

          {/* Identity & badges */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-3xl font-extrabold text-[#111629]">{displayName}</h1>
              <CountryBadge code={country} />
              {years != null && (
                <span className="rounded-full bg-[#D3F501] px-2 py-0.5 text-xs font-semibold text-[#111629]">{years}+ yrs exp</span>
              )}
            </div>
            <p className="mt-1 text-lg font-semibold text-[#111629] opacity-90">{headline}</p>

            {/* Languages */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {languages.length ? (
                languages.map((lang, i) => (
                  <span key={`${lang}-${i}-${tutorId}`} className="rounded-full border border-[#CDD5E0] px-2 py-0.5 text-xs font-medium text-[#111629]">{lang}</span>
                ))
              ) : (
                <span className="text-xs text-[#111629] opacity-60">Languages not set</span>
              )}
            </div>
          </div>

          {/* Rate & primary CTAs */}
          <div className="md:self-stretch md:flex-none">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#CDD5E0] bg-[#F7F8FA] p-5 text-center">
              <div>
                <div className="text-sm font-medium text-[#111629] opacity-70">Hourly rate</div>
                <div className="mt-1 text-4xl font-extrabold tracking-tight text-[#111629]">{rate ? `£${rate}` : "—"}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={`/messages/${tutorId}?filter=all`}
                  className="inline-flex items-center justify-center rounded-md border border-[#CDD5E0] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#F7D250] hover:text-[#111629]"
                >
                  Message
                </Link>
                {authed ? (
                  <button
                    onClick={() => alert("Booking flow coming soon")}
                    className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#D3F501]"
                  >
                    Book trial
                  </button>
                ) : (
                  <Link
                    href={`/signin?next=${nextParam}`}
                    className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#D3F501]"
                  >
                    Book trial
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-[#111629]">About</h2>
        <p className="mt-2 whitespace-pre-line text-gray-700">{bio}</p>
      </div>

      {/* Weekly booking schedule */}
      <div className="mt-6 rounded-2xl border border-[#CDD5E0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Times shown in {localTimezone}</span>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-[#02667C] hover:bg-[#E5F6F8]"
            >
              Back to this week
            </button>
          </div>
        </div>

        {refreshing ? (
          <div className="mt-4 text-xs text-slate-400">Refreshing availability…</div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => {
            const dayDate = addDays(weekStart, index);
            const dayName = dayLabelFormatter.format(dayDate);
            const dayNum = dayDate.getDate();
            const daySlots = slotsByDay[index];

            return (
              <div key={index} className="flex flex-col rounded-2xl border border-[#E6EEF0] bg-[#F8FDFE] p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between border-b border-[#E0EAEB] pb-2">
                  <div className="text-sm font-semibold text-[#02667C]">{dayName}</div>
                  <div className="text-xs font-semibold text-slate-400">{dayNum}</div>
                </div>

                {daySlots.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-xs text-slate-300">No slots</div>
                ) : (
                  <div className="space-y-2 text-center text-sm text-[#02667C]">
                    {daySlots.map((slot) => {
                      const startLabel = timeFormatter.format(new Date(slot.starts_at));
                      const isSoon = sameDay(new Date(slot.starts_at), new Date());
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => onPickSlot(slot.id)}
                          className={`w-full rounded-md px-2 py-1 font-semibold transition hover:bg-[#D6F1F5] ${
                            isSoon ? "bg-[#EAF9FC]" : "bg-[#F8FDFE]"
                          }`}
                        >
                          {startLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!hasSlotsThisWeek ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            No upcoming slots this week. Try navigating to another week or check back soon.
          </div>
        ) : null}
      </div>

      {/* Weekly pattern summary (fallback when no explicit slots) */}
      {pattern && slots.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-[#111629]">Recurring weekly pattern</h2>
            {patternTimezone ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Times shown in {patternTimezone}
              </span>
            ) : null}
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[720px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-7 gap-6 border-t border-slate-200 pt-4 text-sm">
                {DAY_ORDER.map((dayIndex) => {
                  const dayKey = dayIndex.toString() as keyof AvailabilityPattern;
                  const labelKey = dayIndex.toString() as DayKey;
                  const dayHours = pattern[dayKey] ?? [];
                  const ranges = convertHoursToRanges(dayHours);

                  return (
                    <div key={dayKey} className="flex flex-col">
                      <div className="mb-3 text-center">
                        <div className="text-sm font-semibold text-[#02667C]">{DAY_FULL_LABELS[labelKey]}</div>
                        <div className="mt-1 h-1 rounded-full bg-[#02667C]/30" />
                      </div>

                      {ranges.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-50 py-6 text-xs text-slate-300">
                          No slots
                        </div>
                      ) : (
                        <div className="space-y-3 text-center font-medium text-[#02667C]">
                          {ranges.map((range, groupIdx) => (
                            <div key={`${dayKey}-${groupIdx}`} className="space-y-1">
                              {Array.from({ length: range.end - range.start }, (_, i) => range.start + i).map((hour) => (
                                <div key={`${dayKey}-${groupIdx}-${hour}`} className="rounded-md bg-[#E5F6F8] px-2 py-1 tabular-nums">
                                  {formatHour(hour)}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Placeholder for reviews/availability */}
      <div className="mt-6 rounded-xl border bg-white p-5 text-sm text-muted-foreground">
        Reviews and availability calendar coming soon.
      </div>
      <SlotHoldModal slotId={activeSlotId} open={holdOpen} onClose={handleModalClose} />
    </div>
  );
}
