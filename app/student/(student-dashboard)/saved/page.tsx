"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TutorCard from "@features/tutors/components/TutorCard";
import TutorCardSkeleton from "@features/tutors/components/TutorCard.Skeleton";
import { useSavedTutors } from "@features/tutors/hooks/useSavedTutors";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const DIRECTORY_FIELDS = "id, name, headline, languages, hourly_rate_cents, years_experience, image, country_code";

type DirectoryTutor = {
  id: string;
  name: string;
  headline: string | null;
  languages: string[] | null;
  hourly_rate_cents: number | null;
  years_experience: number | null;
  image: string | null;
  country_code: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export default function SavedTutorsPage() {
  const supabase = useMemo(createSupabaseBrowserClient, []);
  const savedState = useSavedTutors();

  const [loadingTutors, setLoadingTutors] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<DirectoryTutor[]>([]);

  const savedIds = useMemo(() => savedState.savedIdList, [savedState.savedIdList]);

  useEffect(() => {
    if (!savedState.hasSession) {
      setTutors([]);
      setFetchError(null);
      setLoadingTutors(false);
      return;
    }

    if (savedState.loading) {
      setLoadingTutors(true);
      return;
    }

    if (savedIds.length === 0) {
      setTutors([]);
      setFetchError(null);
      setLoadingTutors(false);
      return;
    }

    let active = true;

    async function load() {
      setLoadingTutors(true);
      try {
        const { data, error } = await supabase
          .from("tutor_directory")
          .select(DIRECTORY_FIELDS)
          .in("id", savedIds);

        if (!active) return;

        if (error) {
          setFetchError(getErrorMessage(error));
          setTutors([]);
        } else {
          const rows = data ?? [];
          const byId = new Map(rows.map((row) => [row.id, row]));
          const ordered = savedIds
            .map((id) => byId.get(id))
            .filter((row): row is DirectoryTutor => Boolean(row));
          setTutors(ordered);
          setFetchError(null);
        }
      } catch (err) {
        if (!active) return;
        setFetchError(getErrorMessage(err));
        setTutors([]);
      } finally {
        if (active) setLoadingTutors(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [savedIds, savedState.hasSession, savedState.loading, supabase]);

  const isLoading = savedState.loading || loadingTutors;
  const showEmptyState = !isLoading && savedState.hasSession && savedIds.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 text-center lg:text-left">
        <h1 className="text-2xl font-semibold text-[#111629]">Saved tutors</h1>
        <p className="mt-1 text-sm text-slate-600">
          Keep track of tutors you&apos;re interested in and revisit them later.
        </p>
      </div>

      {savedState.error ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <div className="flex items-start justify-between gap-4">
            <span>We couldn&apos;t update your saved tutors. {savedState.error}</span>
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

      {fetchError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {fetchError}
        </div>
      ) : null}

      {!savedState.loading && !savedState.hasSession ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          <p>You need an account to save tutors.</p>
          <Link
            href="/student/signin"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-[#F7D250] px-4 py-2 text-sm font-semibold text-[#111629] hover:bg-[#D3F501]"
          >
            Sign in to continue
          </Link>
        </div>
      ) : null}

      {isLoading ? (
        <ul className="grid grid-cols-1 gap-5">
          {Array.from({ length: Math.max(savedIds.length || 3, 3) }).map((_, idx) => (
            <li key={idx}>
              <TutorCardSkeleton />
            </li>
          ))}
        </ul>
      ) : null}

      {showEmptyState ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Your saved tutors will appear here. Browse the <Link href="/student/find-tutors" className="font-semibold text-[#111629] underline">Find Tutors</Link> page to start saving profiles.
        </div>
      ) : null}

      {!isLoading && savedState.hasSession && tutors.length > 0 ? (
        <ul className="grid grid-cols-1 gap-5">
          {tutors.map((tutor) => {
            const href = `/student/tutors/${tutor.id}`;
            const messageHref = `/messages/${tutor.id}?filter=all`;
            return (
              <li key={tutor.id}>
                <TutorCard
                  tutor={{
                    id: tutor.id,
                    full_name: tutor.name,
                    headline: tutor.headline,
                    languages: tutor.languages ?? [],
                    rate_cents: tutor.hourly_rate_cents,
                    years_experience: tutor.years_experience,
                    avatar_url: tutor.image,
                    country_code: tutor.country_code,
                  }}
                  href={href}
                  onMessageHref={messageHref}
                  saveAction={{
                    isSaved: savedState.isSaved(tutor.id),
                    isBusy: savedState.isPending(tutor.id),
                    onToggle: () => savedState.toggleSave(tutor.id),
                  }}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
