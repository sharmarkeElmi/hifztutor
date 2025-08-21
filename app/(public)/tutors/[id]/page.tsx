"use client";

/**
 * Public Tutor Profile
 * Route: /tutors/[id]
 * Reads from:
 *  - profiles (full_name, role, avatar_url)
 *  - tutor_profiles (headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url)
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/app/components/Header";
import SlotHoldModal from "@/app/components/booking/SlotHoldModal";

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

export default function PublicTutorProfilePage() {
  const params = useParams<{ id: string }>();
  const tutorId = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tutor, setTutor] = useState<TutorProfileRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [holdOpen, setHoldOpen] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        .select("tutor_id, headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url")
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

        // 3) Open future slots for this tutor (public list)
        const { data: s, error: sErr } = await supabase
          .from("lesson_slots")
          .select("id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at")
          .eq("tutor_id", tutorId)
          .eq("status", "open")
          .gt("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(20);

        if (sErr) {
          if (!cancelled) {
            // don't block page render—just show no slots
            setSlots([]);
          }
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
  }, [tutorId]);

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
  }, []);

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
      .select("id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at")
      .eq("tutor_id", tutorId)
      .eq("status", "open")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(20);
    if (!error) setSlots(data ?? []);
    setRefreshing(false);
  }

  function onPickSlot(slotId: string) {
    setActiveSlotId(slotId);
    setHoldOpen(true);
  }

  function handleModalClose() {
    setHoldOpen(false);
    setActiveSlotId(null);
    // Refresh availability so held/booked states reflect immediately
    void refreshSlots();
  }


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
    // Make Monday the first day of the week
    const day = (date.getDay() + 6) % 7;
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
    // sort each day by time
    buckets.forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      )
    );
    return buckets;
  }, [weekSlots]);

  const weekLabel = `${df.format(weekStart)} – ${df.format(addDays(weekStart, 6))}`;

  const displayName = profile?.full_name ?? "Hifz Tutor";
  const headline = tutor?.headline ?? "Qur’an / Hifz tutor";
  const bio = tutor?.bio ?? "This tutor hasn’t added a bio yet.";
  const languages = tutor?.languages ?? [];
  const rate = tutor?.hourly_rate_cents != null ? (tutor.hourly_rate_cents / 100).toFixed(0) : null;
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
    const base = 127397; // 'A' 🇦
    const chars = code.toUpperCase().split("").map((c) => base + c.charCodeAt(0));
    return String.fromCodePoint(...chars);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="animate-pulse text-sm text-muted-foreground">Loading tutor…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-semibold">Tutor not found</h1>
        <p className="mt-1 text-muted-foreground">This profile doesn’t exist or isn’t public.</p>
        <div className="mt-4">
          <Link href="/tutors" className="text-emerald-700 hover:underline">Back to tutors</Link>
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
    <>
      <Header />
      <div className="mx-auto max-w-5xl p-6">
      {/* Header / card */}
      <div className="flex flex-col gap-6 rounded-xl border bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-emerald-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{displayName}</h1>
            <CountryBadge code={country} />
            {years != null && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                {years}+ yrs exp
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{headline}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {languages.length ? (
              languages.map((lang, i) => (
                <span key={`${lang}-${i}`} className="rounded-full border px-2 py-0.5 text-xs text-gray-700">
                  {lang}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Languages not set</span>
            )}
          </div>
        </div>

        <div className="w-full md:w-auto">
          <div className="rounded-lg border bg-gray-50 p-4 text-center">
            <div className="text-sm text-muted-foreground">Hourly rate</div>
            <div className="text-2xl font-semibold">
              {rate ? `£${rate}` : "—"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={`/messages/${tutorId}`}
                className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-gray-100"
              >
                Message
              </Link>
              {authed ? (
                <button
                  onClick={() => alert("Booking flow coming soon")}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
                >
                  Book trial
                </button>
              ) : (
                <Link
                  href={`/student/signin?next=${nextParam}`}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
                >
                  Book trial
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2 whitespace-pre-line text-gray-700">{bio}</p>
      </div>

      {/* Available lessons (public) - weekly grid */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex overflow-hidden rounded-md border">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-3 py-2 text-sm hover:bg-gray-50"
              aria-label="Previous week"
            >
              ‹
            </button>
            <div className="px-3 py-2 text-sm font-medium border-l border-r">
              {weekLabel}
            </div>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-3 py-2 text-sm hover:bg-gray-50"
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          <span className="text-xs text-gray-500">
            Times shown in your local timezone
          </span>
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
              <div key={i} className="rounded-lg border bg-gray-50 p-3">
                <div className="mb-2 flex items-end justify-between">
                  <div className="font-medium">
                    {dayLabel}
                  </div>
                  <div className="text-xs text-gray-500">{dateNum}</div>
                </div>

                {daySlots.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">—</div>
                ) : (
                  <ul className="space-y-2">
                    {daySlots.map((s) => {
                      return (
                        <li key={s.id}>
                          {(() => {
                            const now = Date.now();
                            const isHeld =
                              s.status !== "open" ||
                              (s.hold_expires_at ? new Date(s.hold_expires_at).getTime() > now : false);
                            const start = tf.format(new Date(s.starts_at));
                            const price = s.price_cents != null ? `£${(s.price_cents / 100).toFixed(0)}` : "£—";
                            const label = isHeld ? (s.status === "booked" ? "Booked" : "Held") : "Select";
                            return (
                              <button
                                onClick={() => onPickSlot(s.id)}
                                disabled={isHeld}
                                className={[
                                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm shadow-sm ring-1 transition",
                                  isHeld
                                    ? "cursor-not-allowed bg-gray-100 text-gray-500 ring-gray-200"
                                    : "bg-white ring-gray-200 hover:bg-emerald-50"
                                ].join(" ")}
                                title={`${new Date(s.starts_at).toLocaleString()} → ${new Date(s.ends_at ?? s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                              >
                                <span className="tabular-nums">{start}</span>
                                <span className={[
                                  "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ring-1",
                                  isHeld ? "bg-gray-100 text-gray-600 ring-gray-200" : "bg-emerald-50 text-emerald-700 ring-emerald-100",
                                ].join(" ")}>{label}</span>
                                <span className="text-xs text-gray-500">{price}</span>
                              </button>
                            );
                          })()}
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
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Back to this week
          </button>
        </div>
      </div>

      {/* Placeholder for reviews/availability */}
      <div className="mt-6 rounded-xl border bg-white p-5 text-sm text-muted-foreground">
        Reviews and availability calendar coming soon.
      </div>
      <SlotHoldModal
        slotId={activeSlotId}
        open={holdOpen}
        onClose={handleModalClose}
        onContinue={() => {
          // TODO: navigate to checkout when implemented
          handleModalClose();
        }}
      />
    </div>
    </>
  );
}