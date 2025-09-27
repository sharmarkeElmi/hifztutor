"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const TABLE = "saved_tutors";
const LOCAL_STORAGE_PREFIX = "ht:saved-tutors:";

type SavedTutorRow = {
  tutor_id: string;
};

type PendingMap = Record<string, boolean>;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function formatFriendlyError(err: unknown): string {
  if (!err || typeof err !== "object") return getErrorMessage(err);
  const { code, message, status } = err as { code?: string; message?: string; status?: number };
  const normalizedStatus = typeof status === "number" ? status : undefined;

  if (normalizedStatus === 401) return "Please sign in to manage your saved tutors.";
  if (normalizedStatus === 403 || code === "42501") {
    return "This tutor can\'t be saved right now. They may no longer be listed.";
  }
  if (code === "23503" || (message && message.toLowerCase().includes("foreign key"))) {
    return "This tutor can\'t be saved right now. They may no longer be listed.";
  }
  if (code === "PGRST205") {
    return "Saved tutors are temporarily unavailable. Showing stored results instead.";
  }
  return message || getErrorMessage(err);
}

export function useSavedTutors() {
  const supabase = useMemo(createSupabaseBrowserClient, []);
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMap>({});
  const [supportsRemote, setSupportsRemote] = useState(true);

  // Resolve the current session and watch for auth changes
  useEffect(() => {
    let active = true;

    async function resolveSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;
        setUserId(user?.id ?? null);
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err));
        setUserId(null);
      } finally {
        if (active) setInitialising(false);
      }
    }

    resolveSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      authListener.subscription?.unsubscribe();
    };
  }, [supabase]);

  const loadFromLocal = useCallback(
    (studentId: string) => {
      try {
        const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${studentId}`);
        if (!raw) {
          setSavedIds(new Set());
          return;
        }
        const parsed = JSON.parse(raw) as string[];
        const next = new Set<string>();
        parsed.filter((id) => typeof id === "string" && id.trim()).forEach((id) => next.add(id));
        setSavedIds(next);
      } catch {
        setSavedIds(new Set());
      }
    },
    []
  );

  const persistLocal = useCallback((studentId: string, ids: Set<string>) => {
    try {
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${studentId}`, JSON.stringify(Array.from(ids)));
    } catch {
      // ignore quota errors
    }
  }, []);

  const fetchSaved = useCallback(
    async (studentId: string) => {
      setLoadingSaved(true);
      try {
        const { data, error: fetchError } = await supabase
          .from(TABLE)
          .select("tutor_id")
          .eq("student_id", studentId);
        if (fetchError) throw fetchError;
        const collected = new Set<string>();
        (data ?? []).forEach((row: SavedTutorRow) => {
          if (row?.tutor_id) collected.add(row.tutor_id);
        });
        setSavedIds(collected);
        setError(null);
        setSupportsRemote(true);
        if (typeof window !== "undefined") persistLocal(studentId, collected);
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "PGRST205") {
          setSupportsRemote(false);
          if (typeof window !== "undefined") loadFromLocal(studentId);
          setError(formatFriendlyError(err));
        } else {
          setError(formatFriendlyError(err));
          setSavedIds(new Set());
        }
      } finally {
        setLoadingSaved(false);
      }
    },
    [loadFromLocal, persistLocal, supabase]
  );

  // Load saved tutor IDs whenever the session changes
  useEffect(() => {
    if (initialising) return;
    if (!userId) {
      setSavedIds(new Set());
      setLoadingSaved(false);
      return;
    }
    void fetchSaved(userId);
  }, [userId, fetchSaved, initialising]);

  const ensureAuth = useCallback(() => {
    if (userId) return true;
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/student/signin?next=${next}`);
    } else {
      router.push("/student/signin");
    }
    return false;
  }, [router, userId]);

  const toggleSave = useCallback(
    async (tutorId: string) => {
      if (!ensureAuth()) return;
      if (!userId) return;

      setPending((prev) => ({ ...prev, [tutorId]: true }));
      const alreadySaved = savedIds.has(tutorId);

      try {
        if (supportsRemote) {
          if (alreadySaved) {
            const { error: deleteError } = await supabase
              .from(TABLE)
              .delete()
              .eq("student_id", userId)
              .eq("tutor_id", tutorId);
            if (deleteError) throw deleteError;
          } else {
            const { error: insertError } = await supabase
              .from(TABLE)
              .upsert({ student_id: userId, tutor_id: tutorId }, { onConflict: "student_id,tutor_id" });
            if (insertError) throw insertError;
          }
        }

        setSavedIds((prev) => {
          const next = new Set(prev);
          if (alreadySaved) {
            next.delete(tutorId);
          } else {
            next.add(tutorId);
          }
          if (!supportsRemote && typeof window !== "undefined") {
            persistLocal(userId, next);
          }
          return next;
        });

        setError(null);
      } catch (err) {
        setError(formatFriendlyError(err));
      } finally {
        setPending((prev) => {
          const nextMap = { ...prev };
          delete nextMap[tutorId];
          return nextMap;
        });
      }
    },
    [ensureAuth, persistLocal, savedIds, supabase, supportsRemote, userId]
  );

  const isSaved = useCallback((tutorId: string) => savedIds.has(tutorId), [savedIds]);
  const isPending = useCallback((tutorId: string) => !!pending[tutorId], [pending]);

  const savedIdList = useMemo(() => Array.from(savedIds), [savedIds]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await fetchSaved(userId);
  }, [fetchSaved, userId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    savedIds,
    savedIdList,
    isSaved,
    isPending,
    toggleSave,
    refresh,
    ensureAuth,
    hasSession: !!userId,
    loading: initialising || loadingSaved,
    error,
    clearError,
    supportsRemote,
  } as const;
}
