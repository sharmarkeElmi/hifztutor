import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  DEFAULT_LESSON_STATE,
  type LessonState,
  type LessonStatePatch,
  mergeLessonState,
} from "@/lib/lesson-state";

type UseLessonStateReturn = {
  state: LessonState;
  loading: boolean;
  error: string | null;
  updateState: (patch: LessonStatePatch) => Promise<void>;
};

export function useLessonState(roomName: string): UseLessonStateReturn {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<LessonState>(DEFAULT_LESSON_STATE);
  const stateRef = useRef<LessonState>(DEFAULT_LESSON_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const ensureRow = async () => {
      const { data, error } = await supabase
        .from("lesson_state")
        .select("payload")
        .eq("room_name", roomName)
        .maybeSingle<{ payload: LessonState | null }>();

      if (cancelled) {
        return;
      }

      if (error && error.code !== "PGRST116") {
        console.error("lesson_state fetch error:", error);
        setError("Unable to load classroom state.");
      }

      if (data?.payload) {
        const merged = mergeLessonState(DEFAULT_LESSON_STATE, data.payload);
        stateRef.current = merged;
        setState(merged);
        setLoading(false);
        return;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("lesson_state")
        .upsert(
          { room_name: roomName, payload: DEFAULT_LESSON_STATE },
          { onConflict: "room_name" }
        )
        .select("payload")
        .single<{ payload: LessonState | null }>();

      if (cancelled) {
        return;
      }

      if (insertErr && insertErr.code !== "PGRST116") {
        console.error("lesson_state upsert error:", insertErr);
        setError("Unable to initialise classroom state.");
        setLoading(false);
        return;
      }

      const merged = mergeLessonState(
        DEFAULT_LESSON_STATE,
        inserted?.payload ?? DEFAULT_LESSON_STATE
      );
      stateRef.current = merged;
      setState(merged);
      setLoading(false);
    };

    const subscribe = () => {
      channel = supabase
        .channel(`lesson_state:${roomName}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lesson_state",
            filter: `room_name=eq.${roomName}`,
          },
          (payload) => {
            const nextPayload = (payload.new as { payload?: LessonState })?.payload;
            if (!nextPayload) return;
            const merged = mergeLessonState(DEFAULT_LESSON_STATE, nextPayload);
            stateRef.current = merged;
            setState(merged);
          }
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("lesson_state channel error");
          }
        });
    };

    void ensureRow().then(() => {
      if (!cancelled) {
        subscribe();
      }
    });

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [roomName, supabase]);

  const updateState = useCallback(
    async (patch: LessonStatePatch) => {
      const next = mergeLessonState(stateRef.current, patch);
      stateRef.current = next;
      setState(next);

      const { error } = await supabase
        .from("lesson_state")
        .upsert({
          room_name: roomName,
          payload: next,
        })
        .select("room_name")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("lesson_state update error:", error);
        setError("We couldn’t save the classroom state. Changes may not sync.");
      }
    },
    [roomName, supabase]
  );

  return { state, loading, error, updateState };
}
