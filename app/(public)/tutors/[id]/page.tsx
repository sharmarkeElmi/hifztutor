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
import { createBrowserClient } from "@supabase/ssr";
import Footer from "@/app/components/Footer";
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

      // Note on statuses:
      // - "available": can be picked
      // - "held": temporarily reserved by a student until hold_expires_at
      // - "booked": purchased; not selectable
      // We only list "available" here.
      const { data: s, error: sErr } = await supabase
        .from("lesson_slots")
        .select("id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at")
        .eq("tutor_id", tutorId)
        .eq("status", "available")
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
      .select("id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at")
      .eq("tutor_id", tutorId)
      .eq("status", "available")
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
                  href={`/messages/${tutorId}`}
                  className="inline-flex items-center justify-center rounded-md border border-[#CDD5E0] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#F7D250] hover:text-[#111629]"
                >
                  Message
                </Link>
                {authed ? (
                  <button
                    onClick={() => alert('Booking flow coming soon')}
                    className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#D3F501]"
                  >
                    Book trial
                  </button>
                ) : (
                  <Link
                    href={`/student/signin?next=${nextParam}`}
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

      {/* Available lessons (public) - weekly grid */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
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
              <div key={i} className="rounded-xl border border-[#CDD5E0] bg-white p-3">
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
                              s.status !== "available" ||
                              (s.hold_expires_at ? new Date(s.hold_expires_at).getTime() > now : false);
                            const start = tf.format(new Date(s.starts_at));
                            const price = s.price_cents != null ? `£${(s.price_cents / 100).toFixed(0)}` : "£—";
                            const label =
                              s.status === "booked" ? "Booked"
                              : s.status === "held" ? "Held"
                              : isHeld ? "Unavailable"
                              : "Select";
                            return (
                              <button
                                onClick={() => onPickSlot(s.id)}
                                disabled={isHeld}
                                className={[
                                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm shadow-sm ring-1 transition",
                                  isHeld
                                    ? "cursor-not-allowed bg-gray-100 text-gray-500 ring-gray-200"
                                    : "bg-white ring-[#CDD5E0] hover:bg-[#F7D250] hover:text-[#111629]"
                                ].join(" ")}
                                title={`${new Date(s.starts_at).toLocaleString()} → ${new Date(s.ends_at ?? s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                              >
                                <span className="tabular-nums">{start}</span>
                                <span className={[
                                  "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ring-1",
                                  isHeld
                                    ? "bg-[#CDD5E0] text-[#111629] ring-[#CDD5E0]"
                                    : "bg-[#F7D250] text-[#111629] ring-[#CDD5E0]",
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
            className="rounded-md border border-[#CDD5E0] px-3 py-1.5 text-sm text-[#111629] hover:bg-[#F7D250]"
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
      />
      </div>
      <Footer />
    </>
  );
}
