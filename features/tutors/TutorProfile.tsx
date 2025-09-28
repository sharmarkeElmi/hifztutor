"use client";

/**
 * Shared Tutor Profile UI
 * Reused by public and dashboard-scoped routes.
 * Does not render public Footer; parent decides the chrome.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import SlotHoldModal from "@features/booking/components/SlotHoldModal";
import AvailabilityGrid from "@features/tutors/components/AvailabilityGrid";

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
          "tutor_id, headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url"
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
          .limit(20);

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
    void refreshSlots();
  }

  // Availability presentation is delegated to AvailabilityGrid.

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

      {/* Available lessons - weekly grid */}
      <div className="mt-6">
        <AvailabilityGrid slots={slots} refreshing={refreshing} onSelectSlot={onPickSlot} />
      </div>

      {/* Placeholder for reviews/availability */}
      <div className="mt-6 rounded-xl border bg-white p-5 text-sm text-muted-foreground">
        Reviews and availability calendar coming soon.
      </div>
      <SlotHoldModal slotId={activeSlotId} open={holdOpen} onClose={handleModalClose} />
    </div>
  );
}
