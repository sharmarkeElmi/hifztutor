"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

/** Row from the public.tutor_directory view */
type DirectoryRow = {
  id: string;
  name: string;
  headline: string | null;
  languages: string[];
  hourly_rate_cents: number | null;
  years_experience: number | null;
  image: string | null;
  bio: string | null;
};

type TutorCardData = {
  id: string;
  name: string;
  headline: string;
  languages: string[];
  rate: number | null; // GBP / hour
  years: number | null;
  image: string | null;
  bio: string | null;
};

type SortKey = "relevance" | "price_low" | "price_high" | "experience";

function formatGBP(rate: number | null) {
  if (rate == null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(rate);
  } catch {
    return `£${rate}`;
  }
}

type BrowseProps = {
  basePath?: "/tutors" | "/student/tutors";
};

export default function TutorsBrowse({ basePath = "/tutors" }: BrowseProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<DirectoryRow[]>([]);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // UI state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("tutor_directory")
        .select(
          "id, name, headline, languages, hourly_rate_cents, years_experience, image, bio"
        )
        .order("years_experience", { ascending: false, nullsFirst: false })
        .limit(200);

      if (cancelled) return;

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as DirectoryRow[]);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const cards: TutorCardData[] = useMemo(() => {
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Hifz Tutor",
      headline: r.headline ?? "Qur’an / Hifz tutor",
      languages: r.languages ?? [],
      rate:
        r.hourly_rate_cents != null
          ? Math.round(r.hourly_rate_cents / 100)
          : null,
      years: r.years_experience ?? null,
      image: r.image ?? null,
      bio: r.bio ?? null,
    }));
  }, [rows]);

  // Filter by query (name, headline, languages)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const haystack = [c.name, c.headline, ...c.languages]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cards, query]);

  // Sort on the client for MVP
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "price_low":
        arr.sort((a, b) => (a.rate ?? 999999) - (b.rate ?? 999999));
        break;
      case "price_high":
        arr.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
        break;
      case "experience":
        arr.sort((a, b) => (b.years ?? 0) - (a.years ?? 0));
        break;
      default:
        // relevance = keep filtered order
        break;
    }
    return arr;
  }, [filtered, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Title / Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Find a HifzTutor</h1>
          <p className="text-sm text-gray-600">
            Browse Qur’an / Hifz tutors and start a conversation.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {/* Search */}
          <form onSubmit={(e) => e.preventDefault()} className="relative w-full sm:w-80">
            <label htmlFor="tutor-search" className="sr-only">
              Search tutors
            </label>
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>
            <input
              id="tutor-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, headline, language…"
              className="w-full rounded-md border pl-9 pr-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            />
          </form>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-gray-600">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border bg-white px-2 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
            >
              <option value="relevance">Relevance</option>
              <option value="experience">Experience</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* States */}
      {loading && <SkeletonGrid />}

      {!loading && errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {!loading && !errorMsg && sorted.length === 0 && (
        <div className="rounded-md border bg-white p-6 text-sm text-gray-600">
          No tutors match your search yet.
        </div>
      )}

      {/* Tutor grid */}
      {!loading && !errorMsg && sorted.length > 0 && (
        <ul className="grid grid-cols-1 gap-5">
          {sorted.map((t) => (
            <li key={t.id}>
              <TutorCard t={t} basePath={basePath} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Card */
function TutorCard({ t, basePath }: { t: TutorCardData; basePath: "/tutors" | "/student/tutors" }) {
  return (
    <div className="group h-full rounded-2xl border border-[#CDD5E0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* Band layout: photo | info | rate/CTAs */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8 lg:min-h-[200px]">
        {/* Photo */}
        <div className="relative overflow-hidden rounded-2xl ring-4 ring-[#F7F8FA] h-[160px] w-full lg:h-[160px] lg:w-[220px] lg:flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
            alt={t.name}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Identity & summary */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${basePath}/${t.id}`}
              className="truncate text-2xl font-extrabold leading-snug text-[#111629] hover:underline"
              title={t.name}
            >
              {t.name}
            </Link>
            {t.years != null && t.years > 0 && (
              <span className="rounded-full bg-[#D3F501] px-2 py-0.5 text-[11px] font-semibold text-[#111629] ring-1 ring-[#CDD5E0]">
                {t.years}+ yrs exp
              </span>
            )}
          </div>

          {t.headline && (
            <h3 className="mt-1 line-clamp-1 text-lg font-semibold text-[#111629]">
              {t.headline}
            </h3>
          )}

          {t.languages.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {t.languages.map((lang, i) => (
                <span
                  key={`${lang}-${i}-${t.id}`}
                  className="rounded-full border border-[#CDD5E0] px-2 py-0.5 text-xs font-medium text-[#111629]"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}

          {(() => {
            const raw = (t.bio ?? "").replace(/\s+/g, " ").trim();
            if (!raw) return null;
            const snippet = raw.length > 180 ? raw.slice(0, 180) + "…" : raw;
            return (
              <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[#111629] opacity-80">
                {snippet} {" "}
                <Link href={`${basePath}/${t.id}`} className="font-semibold text-[#111629] hover:underline">
                  Learn more
                </Link>
              </p>
            );
          })()}
        </div>

        {/* Rate & CTAs */}
        <div className="lg:self-stretch lg:flex-none w-full lg:w-[260px]">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-[#CDD5E0] bg-[#F7F8FA] p-5 text-center">
            <div>
              <div className="text-sm font-medium text-[#111629] opacity-70">50‑min lesson</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-[#111629]">{formatGBP(t.rate)}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={`/messages/${t.id}?filter=all`}
                className="inline-flex items-center justify-center rounded-md border border-[#CDD5E0] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#F7D250] hover:text-[#111629]"
              >
                Message
              </Link>
              <Link
                href={`${basePath}/${t.id}`}
                className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#D3F501]"
              >
                Book trial
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeletons while loading */
function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <div className="h-full rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
              <div className="h-5 w-14 animate-pulse rounded-full bg-gray-100" />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="h-6 w-20 animate-pulse rounded bg-gray-100" />
              <div className="flex gap-2">
                <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-9 w-24 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tiny search icon (no external deps) */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
