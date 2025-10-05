"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@components/ui/button";
import WeeklyGrid from "@features/schedule/components/WeeklyGrid";
import TimeOffModal from "@features/schedule/components/TimeOffModal";
import AgendaList from "@features/schedule/components/AgendaList";
import type { AvailabilityPattern, TimeOffEntry } from "@features/schedule/lib/types";
import {
  createEmptyPattern,
  ensurePatternKeys,
  normalizePattern,
  patternsEqual,
  sortTimeOff,
} from "@features/schedule/lib/utils";

const VIEW_MODES = ["grid", "agenda"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

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
  const [timeOffEntries, setTimeOffEntries] = useState<TimeOffEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  const gridSectionRef = useRef<HTMLDivElement | null>(null);

  const redirectToSignIn = useCallback(() => {
    const next = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
    window.location.replace(next ? `/signin?next=${encodeURIComponent(next)}` : "/signin");
  }, []);

  const loadTimeOff = useCallback(
    async (uid: string) => {
      const nowIso = new Date().toISOString();
      const { data, error: timeOffError } = await supabase
        .from("tutor_time_off")
        .select("id, tutor_id, starts_at, ends_at, reason")
        .eq("tutor_id", uid)
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true });
      if (timeOffError) {
        throw new Error(timeOffError.message);
      }
      setTimeOffEntries(sortTimeOff((data ?? []) as TimeOffEntry[]));
    },
    [supabase]
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

      const [{ data: patternRow, error: patternError }, { data: profileRow },] = await Promise.all([
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
      ]);

      if (patternError) {
        throw new Error(patternError.message);
      }

      const derivedTimezone = patternRow?.timezone || profileRow?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(derivedTimezone);

      const normalizedPattern = patternRow?.hours_by_dow
        ? normalizePattern(ensurePatternKeys(patternRow.hours_by_dow as Record<string, number[]>))
        : createEmptyPattern();

      setSavedPattern(normalizedPattern);
      setDraftPattern(normalizedPattern);
      setUnsaved(false);
      await loadTimeOff(uid);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadTimeOff, redirectToSignIn, supabase]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

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
      setStatus("Availability saved");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [draftPattern, supabase, timezone, userId]);

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
      await loadTimeOff(userId);
    },
    [loadTimeOff, supabase, userId]
  );

  const dirtySinceSave = useMemo(() => !patternsEqual(savedPattern, draftPattern), [draftPattern, savedPattern]);

  const showSave = unsaved || dirtySinceSave;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setViewMode("grid");
              setTimeout(() => {
                gridSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
          >
            Set availability
          </Button>
          <Button onClick={() => setModalOpen(true)}>Add time off</Button>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-4">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-300 p-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] ${
                  viewMode === mode ? "bg-[#D3F501] text-[#111629]" : "text-slate-600"
                }`}
                aria-pressed={viewMode === mode}
              >
                {mode === "grid" ? "Grid" : "Agenda"}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your timezone: {timezone}</span>
        </div>
      </header>

      {status ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading schedule…</div>
      ) : viewMode === "grid" ? (
        <div ref={gridSectionRef}>
          <WeeklyGrid pattern={savedPattern} onChange={handlePatternChange} />
        </div>
      ) : (
        <AgendaList pattern={savedPattern} timeOff={timeOffEntries} timezone={timezone} />
      )}

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
