"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import TutorCard from "@features/tutors/components/TutorCard";
import TutorCardSkeleton from "@features/tutors/components/TutorCard.Skeleton";
import { useSavedTutors } from "@features/tutors/hooks/useSavedTutors";

/** Row from the public.tutor_directory view */
type DirectoryRow = {
  id: string;
  name: string;
  headline: string | null;
  languages: string[];
  hourly_rate_cents: number | null;
  years_experience: number | null;
  image: string | null;
  country_code: string | null;
  bio: string | null;
};

type TutorCardData = {
  id: string;
  name: string;
  headline: string | null;
  languages: string[];
  years_experience: number | null;
  rate_cents: number | null;
  image: string | null;
  country_code: string | null;
};

type SortKey = "relevance" | "price_low" | "price_high" | "experience";

// formatting helpers moved to @features/tutors/lib/format

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

  const savedState = useSavedTutors();

  // UI state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("tutor_directory")
        .select(
          "id, name, headline, languages, hourly_rate_cents, years_experience, image, country_code, bio"
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
      headline: r.headline ?? null,
      languages: r.languages ?? [],
      years_experience: r.years_experience ?? null,
      rate_cents: r.hourly_rate_cents ?? null,
      image: r.image ?? null,
      country_code: r.country_code ?? null,
    }));
  }, [rows]);

  // Filter by query (name, headline, languages)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const haystack = [c.name, c.headline ?? "", ...c.languages]
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
        arr.sort(
          (a, b) => (a.rate_cents ?? Number.POSITIVE_INFINITY) - (b.rate_cents ?? Number.POSITIVE_INFINITY)
        );
        break;
      case "price_high":
        arr.sort((a, b) => (b.rate_cents ?? -1) - (a.rate_cents ?? -1));
        break;
      case "experience":
        arr.sort((a, b) => (b.years_experience ?? 0) - (a.years_experience ?? 0));
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

      {savedState.error ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <div className="flex items-start justify-between gap-4">
            <span>We couldn&apos;t update your saved tutors right now. {savedState.error}</span>
            <button
              type="button"
              onClick={savedState.clearError}
              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 transition hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

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
          {sorted.map((t) => {
            const href = `${basePath}/${t.id}`;
            const onMessageHref = `/messages/${t.id}?filter=all`;
            return (
              <li key={t.id}>
                <TutorCard
                  tutor={{
                    id: t.id,
                    full_name: t.name,
                    avatar_url: t.image,
                    rate_cents: t.rate_cents,
                    languages: t.languages,
                    headline: t.headline,
                    years_experience: t.years_experience,
                    country_code: t.country_code,
                  }}
                  href={href}
                  onMessageHref={onMessageHref}
                  saveAction={{
                    isSaved: savedState.isSaved(t.id),
                    isBusy: savedState.isPending(t.id),
                    onToggle: () => savedState.toggleSave(t.id),
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Skeletons while loading */
function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-1 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <TutorCardSkeleton />
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
