"use client";

/**
 * LiveKit Room (client)
 * - Requires Supabase sign-in
 * - Loads role + name from profiles
 * - Requests a LiveKit token (server-verified)
 * - Connects to LiveKit Cloud and renders the stock conference UI
 * - Polished: adds a slim header (room, role, name, leave)
 */

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Room as LiveKitRoomType } from "livekit-client";
import {
  LiveKitRoom,
  VideoConference,
  useRoomContext, // for clean disconnect
} from "@livekit/components-react";
import "@livekit/components-styles";

type Props = {
  roomName: string;
  livekitUrl: string;
};

// A small header that lives *inside* LiveKitRoom so it can access the room context.
function RoomHeader({
  roomName,
  role,
  displayName,
  leaveTo,
}: {
  roomName: string;
  role: "student" | "tutor";
  displayName: string;
  leaveTo: string;
}) {
  const room = useRoomContext(); // gives us room.disconnect()

  // Track participant count (local + remotes)
  const [participantCount, setParticipantCount] = useState<number>(1);

  // Track elapsed call time in seconds
  const [elapsed, setElapsed] = useState<number>(0);

  // Format seconds → mm:ss or h:mm:ss
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };

  // Update participant count on connect/join/leave
  useEffect(() => {
    const updateCount = () => {
      // If not connected yet, show 1 if the local participant exists, else 0.
      if (room?.state !== "connected") {
        const local = room?.localParticipant ? 1 : 0;
        setParticipantCount(local);
        return;
      }

      // When connected:
      // Prefer LiveKit v2 API (includes local + remotes)
      if (typeof room.numParticipants === "number") {
        setParticipantCount(room.numParticipants);
        return;
      }

      // Fallback for older versions: remote participants + local (if present)
      const remotes =
        (room as LiveKitRoomType | undefined)?.remoteParticipants?.size ?? 0;
      const local = room?.localParticipant ? 1 : 0;
      setParticipantCount(remotes + local);
    };

    // Initial measurement
    updateCount();

    // React to connection and remote participant changes
    room.on("connected", updateCount);
    room.on("participantConnected", updateCount);
    room.on("participantDisconnected", updateCount);

    return () => {
      room.off("connected", updateCount);
      room.off("participantConnected", updateCount);
      room.off("participantDisconnected", updateCount);
    };
  }, [room]);

  // Start/stop a simple call timer when connected/disconnected
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
      await room.disconnect(true); // gracefully disconnect
    } catch {
      // ignore
    }
    window.location.assign(leaveTo);
  };

  return (
    <div className="mb-3 rounded-xl border border-[#CDD5E0] bg-white/90 backdrop-blur px-3 py-2 sm:px-4 sm:py-2.5 text-[#111629] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shadow">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm">
          Room: <span className="ml-1 font-medium">{roomName}</span>
        </span>
        <span className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm">
          Role: <span className="ml-1 font-medium capitalize">{role}</span>
        </span>
        <span className="hidden sm:inline text-muted-foreground">•</span>
        <span className="truncate" title={displayName}>
          Signed in as <span className="font-medium">{displayName}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm"
          title="Participants in call"
        >
          <span className="mr-1">Participants:</span>
          <span className="font-medium">{participantCount}</span>
        </span>
        <span
          className="inline-flex items-center rounded-full border border-[#CDD5E0] bg-white/80 px-2 py-0.5 text-sm"
          title="Time in call"
        >
          <span className="mr-1">In call:</span>
          <span className="font-medium">{formatDuration(elapsed)}</span>
        </span>
        <button
          onClick={handleLeave}
          className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-1.5 text-sm font-semibold text-[#111629] shadow-sm hover:bg-[#D3F501] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F7D250]"
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

  // UI state
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [leaveTo, setLeaveTo] = useState<string>("/student/dashboard");
  const [role, setRole] = useState<"student" | "tutor">("student"); // for header badge
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      // 1) Require auth
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        router.replace("/student/signin");
        return;
      }
      const user = session.user;

      // 2) Load role + full name from profiles
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profileErr) {
        console.error("Profile load error:", profileErr.message);
      }
      const roleVal =
        (profile?.role as "student" | "tutor" | null) ?? "student";
      setRole(roleVal);
      setLeaveTo(roleVal === "tutor" ? "/tutor/dashboard" : "/student/dashboard");
      const name = profile?.full_name ?? user.email ?? "Guest";

      // 3) Fetch LiveKit token (identity=user.id)
      const accessToken = session.access_token;
      const params = new URLSearchParams({
        room: roomName,
        username: user.id,
        displayName: name,
        access_token: accessToken, // dev-friendly fallback, also sent in header
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
    // IMPORTANT: include `supabase` to satisfy react-hooks/exhaustive-deps
  }, [roomName, router, supabase]);

  // LiveKit CSS variable overrides using brand palette
  const lkVars: React.CSSProperties & Record<string, string> = {
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

  // Loading & error UI
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
      <div className="max-w-xl mx-auto mt-10 space-y-4 text-[#111629]">
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

  // LiveKit video UI with header
  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#111629]">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4">
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
          <div
            data-lk-theme="default"
            style={lkVars}
          >
            <style jsx global>{`
              /* Force dark text/icons on LiveKit control labels and menus */
              [data-lk-theme] .lk-control-bar,
              [data-lk-theme] .lk-control-bar * {
                color: #111629 !important;
              }
              [data-lk-theme] .lk-control-bar .lk-button svg,
              [data-lk-theme] .lk-menu svg {
                fill: #111629 !important;
              }
              /* Ensure menus, tooltips use dark text as well */
              [data-lk-theme] .lk-menu,
              [data-lk-theme] .lk-menu * {
                color: #111629 !important;
              }
            `}</style>
            {/* Polished header above the stock conference UI */}
            <div className="px-2 pt-2 mb-2 sm:mb-3">
              <RoomHeader
                roomName={roomName}
                role={role}
                displayName={displayName}
                leaveTo={leaveTo}
              />
            </div>

            {/* Constrained stage: rounded, with subtle ring; height limited for large screens */}
            <div
              className="rounded-2xl ring-1 ring-[#CDD5E0] bg-black shadow-lg"
              style={{ height: "min(72vh, 820px)" }}
            >
              {/* Stock, accessible conference UI (tiles, mute/cam toggles, leave button, etc.) */}
              <VideoConference />
            </div>
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}