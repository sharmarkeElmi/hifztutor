"use client";

/**
 * Public Tutor Profile
 * Route: /tutors/[id]
 * Reads from:
 *  - profiles (full_name, role, avatar_url)
 *  - tutor_profiles (headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/app/components/Header";

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

export default function PublicTutorProfilePage() {
  const params = useParams<{ id: string }>();
  const tutorId = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tutor, setTutor] = useState<TutorProfileRow | null>(null);

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
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

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
              <button
                onClick={() => alert("Booking flow coming soon")}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
              >
                Book trial
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2 whitespace-pre-line text-gray-700">{bio}</p>
      </div>

      {/* Placeholder for reviews/availability */}
      <div className="mt-6 rounded-xl border bg-white p-5 text-sm text-muted-foreground">
        Reviews and availability calendar coming soon.
      </div>
    </div>
    </>
  );
}