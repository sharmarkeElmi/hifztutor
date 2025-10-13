"use client";

/**
 * LiveKit Classroom Client
 * - Authenticates via Supabase
 * - Requests a LiveKit access token from the server
 * - Renders a custom classroom layout (stage + tools column + controls)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Track, type Room as LiveKitRoomType } from "livekit-client";
import {
  CarouselLayout,
  ControlBar,
  FocusLayout,
  GridLayout,
  LayoutContextProvider,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  ConnectionStateToast,
  useCreateLayoutContext,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { isTrackReference } from "@livekit/components-core";
import "@livekit/components-styles";
import type { TLStoreSnapshot } from "@tldraw/tldraw";
import { useLessonState } from "./use-lesson-state";
import {
  type LessonState,
  type LessonStatePatch,
  type ToolTab,
} from "@/lib/lesson-state";
import { WhiteboardPanel } from "./whiteboard-panel";

type Props = {
  roomName: string;
  livekitUrl: string;
};

const TOOL_TABS: Array<{ key: ToolTab; label: string; description: string }> = [
  { key: "whiteboard", label: "Whiteboard", description: "Sketch, circle, and annotate together." },
  { key: "mushaf", label: "Mushaf", description: "Share the Mushaf, highlight āyāt, and follow tajwīd cues." },
  { key: "notes", label: "Notes", description: "Capture homework, corrections, and reminders." },
];

type Role = "student" | "tutor";

// Top header that lives inside LiveKitRoom so it can access the room context.
function RoomHeader({
  roomName,
  role,
  displayName,
  leaveTo,
}: {
  roomName: string;
  role: Role;
  displayName: string;
  leaveTo: string;
}) {
  const room = useRoomContext(); // gives us room.disconnect()

  const [participantCount, setParticipantCount] = useState<number>(1);
  const [elapsed, setElapsed] = useState<number>(0);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    const updateCount = () => {
      if (room?.state !== "connected") {
        const local = room?.localParticipant ? 1 : 0;
        setParticipantCount(local);
        return;
      }

      if (typeof room.numParticipants === "number") {
        setParticipantCount(room.numParticipants);
        return;
      }

      const remotes =
        (room as LiveKitRoomType | undefined)?.remoteParticipants?.size ?? 0;
      const local = room?.localParticipant ? 1 : 0;
      setParticipantCount(remotes + local);
    };

    updateCount();
    room.on("connected", updateCount);
    room.on("participantConnected", updateCount);
    room.on("participantDisconnected", updateCount);

    return () => {
      room.off("connected", updateCount);
      room.off("participantConnected", updateCount);
      room.off("participantDisconnected", updateCount);
    };
  }, [room]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) clearInterval(interval);
      const startedAt = Date.now();
      setElapsed(0);
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    if (room.state === "connected") start();

    room.on("connected", start);
    room.on("disconnected", stop);

    return () => {
      stop();
      room.off("connected", start);
      room.off("disconnected", stop);
    };
  }, [room]);

  const handleLeave = async () => {
    try {
      await room.disconnect(true);
    } catch {
      // ignore disconnect errors
    }
    window.location.assign(leaveTo);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#CDD5E0] bg-white/90 px-3 py-2 text-[#111629] shadow backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm">
          Room: <span className="ml-1 font-medium">{roomName}</span>
        </span>
        <span className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm capitalize">
          Role: <span className="ml-1 font-medium">{role}</span>
        </span>
        <span className="hidden text-muted-foreground sm:inline">•</span>
        <span className="truncate" title={displayName}>
          Signed in as <span className="font-medium">{displayName}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm">
          <span className="mr-1">Participants:</span>
          <span className="font-medium">{participantCount}</span>
        </span>
        <span className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm">
          <span className="mr-1">In call:</span>
          <span className="font-medium">{formatDuration(elapsed)}</span>
        </span>
        <button
          onClick={handleLeave}
          className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-1.5 text-sm font-semibold text-[#111629] shadow-sm hover:bg-[#D3F501] focus:outline-none focus:ring-2 focus:ring-[#F7D250] focus:ring-offset-2"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

export default function RoomClient({ roomName, livekitUrl }: Props) {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [leaveTo, setLeaveTo] = useState<string>("/student/dashboard");
  const [role, setRole] = useState<Role>("student");
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    state: lessonState,
    loading: lessonStateLoading,
    error: lessonStateError,
    updateState: updateLessonState,
  } = useLessonState(roomName);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Failed to verify auth for lesson room:", userError.message);
      }
      const user = userData?.user;
      if (!user) {
        const next =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : undefined;
        router.replace(
          next ? `/signin?next=${encodeURIComponent(next)}` : "/signin"
        );
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      if (!session?.access_token) {
        setApiError("We couldn't verify your session. Please sign in again.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profileErr) {
        console.error("Profile load error:", profileErr.message);
      }

      const roleVal = (profile?.role as Role | null) ?? "student";
      setRole(roleVal);
      setLeaveTo(roleVal === "tutor" ? "/tutor/dashboard" : "/student/dashboard");
      const name = profile?.full_name ?? user.email ?? "Guest";

      const accessToken = session.access_token;
      const params = new URLSearchParams({
        room: roomName,
        username: user.id,
        displayName: name,
        access_token: accessToken,
      });

      const res = await fetch(`/api/livekit-token?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!active) return;

      if (!res.ok) {
        const text = await res.text();
        setApiError(text);
        setLoading(false);
        return;
      }

      const { token } = (await res.json()) as { token: string | null };
      if (!active) return;

      setDisplayName(name);
      setToken(token ?? null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [roomName, router, supabase]);

  const lkVars: CSSProperties & Record<string, string> = {
    "--lk-control-bar-background": "#111629",
    "--lk-control-bar-text": "#111629",
    "--lk-button-background": "#F7D250",
    "--lk-button-text": "#111629",
    "--lk-focus-ring": "#D3F501",
    "--lk-border-color": "#CDD5E0",
    "--lk-icon-color": "#111629",
    "--lk-text-color": "#111629",
    "--lk-menu-item-text": "#111629",
    "--lk-menu-item-hover-text": "#111629",
    "--lk-background-color": "#F7F8FA",
  };

  if (loading) {
    return (
      <div className="mt-16 flex justify-center">
        <div className="rounded-xl border border-[#CDD5E0] bg-white px-5 py-4 text-sm text-[#111629] shadow-sm">
          Preparing your room…
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto mt-10 max-w-xl space-y-4 text-[#111629]">
        <h1 className="text-2xl font-bold">Couldn&apos;t join the room</h1>
        <p className="text-[#111629]/80">
          {apiError
            ? apiError
            : "We weren&apos;t able to obtain a LiveKit token. Please try again."}
        </p>
        <button
          onClick={() => router.back()}
          className="rounded-md border border-[#CDD5E0] px-3 py-1.5 text-sm text-[#111629] hover:bg-[#F7D250]"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#111629]">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5">
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect
          audio
          video
          onDisconnected={() => {
            window.location.assign(leaveTo);
          }}
        >
          <ClassroomLayout
            roomName={roomName}
            role={role}
            displayName={displayName}
            leaveTo={leaveTo}
            themeVars={lkVars}
            lessonState={lessonState}
            lessonStateLoading={lessonStateLoading}
            lessonStateError={lessonStateError}
            onLessonStateChange={updateLessonState}
          />
        </LiveKitRoom>
      </div>
    </div>
  );
}

type ClassroomLayoutProps = {
  roomName: string;
  role: Role;
  displayName: string;
  leaveTo: string;
  themeVars: CSSProperties & Record<string, string>;
  lessonState: LessonState;
  lessonStateLoading: boolean;
  lessonStateError: string | null;
  onLessonStateChange: (patch: LessonStatePatch) => Promise<void>;
};

function ClassroomLayout({
  roomName,
  role,
  displayName,
  leaveTo,
  themeVars,
  lessonState,
  lessonStateLoading,
  lessonStateError,
  onLessonStateChange,
}: ClassroomLayoutProps) {
  const layoutContext = useCreateLayoutContext();

  return (
    <div data-lk-theme="default" style={themeVars} className="space-y-4">
      <style jsx global>{`
        [data-lk-theme] .lk-control-bar,
        [data-lk-theme] .lk-control-bar * {
          color: #111629 !important;
        }
        [data-lk-theme] .lk-control-bar .lk-button svg,
        [data-lk-theme] .lk-menu svg {
          fill: #111629 !important;
        }
        [data-lk-theme] .lk-menu,
        [data-lk-theme] .lk-menu * {
          color: #111629 !important;
        }
      `}</style>

      <LayoutContextProvider value={layoutContext}>
        <RoomHeader
          roomName={roomName}
          role={role}
          displayName={displayName}
          leaveTo={leaveTo}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),340px] lg:items-start">
          <ClassroomStage />
          <ClassroomTools
            roomName={roomName}
            role={role}
            lessonState={lessonState}
            loading={lessonStateLoading}
            error={lessonStateError}
            onUpdateState={onLessonStateChange}
          />
        </div>

        <CallControls role={role} />

        <RoomAudioRenderer />
        <ConnectionStateToast />
      </LayoutContextProvider>
    </div>
  );
}

function ClassroomStage() {
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  );

  const activeScreenShare = useMemo(
    () =>
      screenShareTracks.find(
        (track) => isTrackReference(track) && track.publication.isSubscribed
      ) ?? null,
    [screenShareTracks]
  );

  return (
    <section className="flex min-h-[520px] flex-col gap-3 rounded-2xl border border-[#233043] bg-[#0f172a]/70 p-3 shadow-lg backdrop-blur">
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
        {activeScreenShare ? (
          <FocusLayout
            trackRef={activeScreenShare}
            className="h-full w-full"
          />
        ) : (
          <GridLayout
            tracks={cameraTracks}
            className="h-full w-full"
            style={{ minHeight: "100%" }}
          >
            <ParticipantTile />
          </GridLayout>
        )}
      </div>

      {activeScreenShare && (
        <div className="rounded-xl border border-[#1f2a3b] bg-[#111629]/80 p-2">
          <CarouselLayout tracks={cameraTracks}>
            <ParticipantTile />
          </CarouselLayout>
        </div>
      )}
    </section>
  );
}

function ClassroomTools({
  roomName,
  role,
  lessonState,
  loading,
  error,
  onUpdateState,
}: {
  roomName: string;
  role: Role;
  lessonState: LessonState;
  loading: boolean;
  error: string | null;
  onUpdateState: (patch: LessonStatePatch) => Promise<void>;
}) {
  const activeTab = lessonState.activeTab ?? "whiteboard";
  const [notesDraft, setNotesDraft] = useState(lessonState.notes.content);
  const [whiteboardSaving, setWhiteboardSaving] = useState(false);
  const whiteboardSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentSnapshot = useRef<string | null>(null);
  const canEditWhiteboard = role === "tutor";

  useEffect(() => {
    setNotesDraft(lessonState.notes.content);
  }, [lessonState.notes.content]);

  useEffect(() => {
    lastSentSnapshot.current = lessonState.whiteboard.snapshot
      ? JSON.stringify(lessonState.whiteboard.snapshot)
      : null;
  }, [lessonState.whiteboard.snapshot]);

  useEffect(() => {
    return () => {
      if (whiteboardSaveTimer.current) {
        clearTimeout(whiteboardSaveTimer.current);
      }
    };
  }, []);

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return "Not saved yet";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleTabChange = (tab: ToolTab) => {
    if (loading || activeTab === tab) return;
    void onUpdateState({ activeTab: tab });
  };

  const handleWhiteboardSnapshot = useCallback(
    (snapshot: TLStoreSnapshot) => {
      if (loading || !canEditWhiteboard) return;
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSentSnapshot.current) return;
      lastSentSnapshot.current = serialized;
      if (whiteboardSaveTimer.current) {
        clearTimeout(whiteboardSaveTimer.current);
      }
      whiteboardSaveTimer.current = setTimeout(() => {
        setWhiteboardSaving(true);
        onUpdateState({
          whiteboard: {
            snapshot,
            lastSavedAt: new Date().toISOString(),
          },
        }).finally(() => {
          setWhiteboardSaving(false);
        });
      }, 700);
    },
    [canEditWhiteboard, loading, onUpdateState]
  );

  const adjustMushafAyah = (delta: number) => {
    if (loading) return;
    const currentAyah = lessonState.mushaf.ayah;
    const nextAyah = Math.max(1, currentAyah + delta);
    void onUpdateState({
      mushaf: { ayah: nextAyah },
    });
  };

  const adjustMushafPage = (delta: number) => {
    if (loading) return;
    const currentPage = lessonState.mushaf.page;
    const nextPage = Math.max(1, currentPage + delta);
    void onUpdateState({
      mushaf: { page: nextPage },
    });
  };

  const handleNotesSave = () => {
    if (loading) return;
    void onUpdateState({
      notes: {
        content: notesDraft,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <aside className="flex h-full min-h-[520px] flex-col rounded-2xl border border-[#CDD5E0] bg-white/95 p-4 shadow-lg backdrop-blur">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-[#111629]">Lesson tools</h2>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Room ID: <span className="font-mono">{roomName}</span>
        </p>
      </header>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {TOOL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={[
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
              activeTab === tab.key
                ? "border-[#F7D250] bg-[#F7D250] text-[#111629] shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-[#F7D250]",
            ].join(" ")}
            disabled={loading}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {TOOL_TABS.find((tab) => tab.key === activeTab)?.description}
        {loading ? " Syncing state…" : ""}
      </p>

      <div className="mt-4 flex-1 rounded-xl border border-dashed border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
        {activeTab === "whiteboard" && (
          <div className="flex h-full flex-col gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#111629]">
                Collaborative whiteboard
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Sketch tajwīd diagrams, outline homework, and sync notes in real time.
              </p>
            </div>
            <WhiteboardPanel
              snapshot={lessonState.whiteboard.snapshot}
              onSnapshotChange={handleWhiteboardSnapshot}
              readOnly={!canEditWhiteboard}
            />
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-500">
              <span>
                Last saved:{" "}
                <span className="font-medium text-[#111629]">
                  {formatTimestamp(lessonState.whiteboard.lastSavedAt)}
                </span>
              </span>
              <span className="text-[#111629]">
                {canEditWhiteboard
                  ? whiteboardSaving
                    ? "Saving…"
                    : "Synced"
                  : "Live view"}
              </span>
            </div>
          </div>
        )}

        {activeTab === "mushaf" && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[#111629]">
              Interactive Mushaf soon
            </h3>
            <p>
              Navigate sūrahs, highlight āyāt, and zoom into tajwīd rules
              together. Shared highlighting will keep both of you in sync.
            </p>
            <p className="text-xs text-slate-500">
              Preloading Madani pages and tajwīd overlays—stay tuned.
            </p>
            <div className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
              <p>
                Current sūrah:{" "}
                <span className="font-semibold text-[#111629]">
                  {lessonState.mushaf.surah}
                </span>
              </p>
              <p>
                Āyah focus:{" "}
                <span className="font-semibold text-[#111629]">
                  {lessonState.mushaf.ayah}
                </span>
              </p>
              <p>
                Page:{" "}
                <span className="font-semibold text-[#111629]">
                  {lessonState.mushaf.page}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => adjustMushafAyah(-1)}
                className="rounded-md border border-slate-200 px-3 py-1 text-[#111629] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                Prev āyah
              </button>
              <button
                type="button"
                onClick={() => adjustMushafAyah(1)}
                className="rounded-md border border-slate-200 px-3 py-1 text-[#111629] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                Next āyah
              </button>
              <button
                type="button"
                onClick={() => adjustMushafPage(-1)}
                className="rounded-md border border-slate-200 px-3 py-1 text-[#111629] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                Prev page
              </button>
              <button
                type="button"
                onClick={() => adjustMushafPage(1)}
                className="rounded-md border border-slate-200 px-3 py-1 text-[#111629] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                Next page
              </button>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[#111629]">
              Lesson notebook
            </h3>
            <p>
              Post-lesson recaps, homework lists, and pronunciation feedback
              will land here. Notes sync to both dashboards.
            </p>
            <p className="text-xs text-slate-500">
              Automatic saving and sharing hooks are on the roadmap.
            </p>
            <div className="space-y-2">
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#111629] shadow-sm focus:border-[#F7D250] focus:outline-none focus:ring-2 focus:ring-[#F7D250]/60 disabled:opacity-60"
                rows={6}
                placeholder="Write homework reminders or tajwīd corrections…"
                disabled={loading}
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Last updated:{" "}
                  <span className="font-medium text-[#111629]">
                    {formatTimestamp(lessonState.notes.updatedAt)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleNotesSave}
                  className="inline-flex items-center rounded-md border border-[#F7D250] px-3 py-1.5 text-xs font-medium text-[#111629] transition hover:bg-[#F7D250]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  Save notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-4 text-xs text-slate-500">
        Building for memorisation &amp; tajwīd mastery — tools are iterating quickly.
      </footer>
    </aside>
  );
}

function CallControls({ role }: { role: Role }) {
  return (
    <section className="rounded-2xl border border-[#CDD5E0] bg-white/95 p-3 shadow">
      <ControlBar
        variation="verbose"
        controls={{ leave: false, chat: false, settings: false }}
        className="flex flex-wrap items-center justify-between gap-2"
      />
      <p className="mt-2 text-xs text-slate-500">
        {role === "tutor"
          ? "Screen share broadcasts to your student instantly. Use the tools panel to prep your Mushaf and whiteboard."
          : "Need to share your screen? Ask your tutor to enable it when ready."}
      </p>
    </section>
  );
}
