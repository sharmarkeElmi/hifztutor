"use client";

/**
 * Client-side LiveKit room component
 * -----------------------------------------
 * Responsibilities:
 *  - Verify the user is signed in (via Supabase).
 *  - Fetch BOTH `role` and `full_name` from `profiles` (single query).
 *  - Request a LiveKit access token from our API route (includes displayName).
 *  - Connect to LiveKit Cloud and render a ready-made video UI.
 *  - Provide basic controls (mic/cam/leave) via <VideoConference />.
 *
 * Notes:
 *  - LiveKit identity must be unique → we use Supabase user.id (UUID).
 *  - LIVEKIT_URL is read server-side and passed down via the server page wrapper.
 *  - On leave, we redirect based on `role` (student → /student/dashboard, tutor → /tutor/dashboard).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

type Props = {
  roomName: string;
  livekitUrl: string;
};

export default function RoomClient({ roomName, livekitUrl }: Props) {
  const router = useRouter();

  // ========== Local UI state ==========
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>(""); // friendly name for UI
  const [leaveTo, setLeaveTo] = useState<string>("/student/dashboard"); // default; updated after role load

  useEffect(() => {
    let active = true;

    (async () => {
      // 1) Require auth
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        // Not signed in → send them to student sign-in (MVP default)
        router.replace("/student/signin");
        return;
      }

      const user = session.user;

      // 2) Load profile (single query for role + full name)
      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        // RLS or table issue — fail gracefully (MVP)
        console.error("Profile load error:", profileErr.message);
      }

      // Derive role (fallback to "student" for safety)
      const role = (profileRow?.role as "student" | "tutor" | null) ?? "student";
      setLeaveTo(role === "tutor" ? "/tutor/dashboard" : "/student/dashboard");

      // Derive display name (full_name → email → "Guest")
      const name =
        profileRow?.full_name ??
        user.email ??
        "Guest";

      // 3) Build identity (unique, stable) and fetch a LiveKit token from our API
      //    - identity: must be globally unique per participant (UUID is perfect)
      //    - displayName: useful for future custom UI (tiles, roster, etc.)
      const uniqueIdentity = user.id;

      const params = new URLSearchParams({
        room: roomName,
        username: uniqueIdentity, // identity embedded in token
        displayName: name,        // friendly name used by UI
      });

      const res = await fetch(`/api/livekit-token?${params.toString()}`, {
        method: "GET",
      });

      if (!active) return;

      if (!res.ok) {
        console.error("Failed to fetch LiveKit token:", await res.text());
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
  }, [roomName, router]);

  // ========== Loading / error states ==========
  if (loading) {
    return <p className="text-center mt-10">Preparing your room…</p>;
  }

  if (!token) {
    return (
      <div className="max-w-xl mx-auto mt-10 space-y-3">
        <h1 className="text-2xl font-semibold">Couldn&apos;t join the room</h1>
        <p className="text-muted-foreground">
          We weren&apos;t able to obtain a LiveKit token. Please try again.
        </p>
        <button
          onClick={() => router.back()}
          className="rounded border px-3 py-1.5 hover:bg-gray-50"
        >
          Go back
        </button>
      </div>
    );
  }

  // ========== LiveKit view ==========
  return (
    <div className="h-[calc(100vh-100px)]">
      {/* 
        LiveKitRoom handles connection lifecycle given a token & server URL.
        - `connect` automatically connects on mount
        - `audio`/`video` as true enables publishing by default
        - onDisconnected: return to the correct dashboard based on role
      */}
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect
        audio
        video
        onDisconnected={() => {
          window.location.assign(leaveTo);
        }}
        // Note: participant label rendering can use the token's `name` in a custom UI later.
      >
        {/* Stock, accessible conference UI (tiles, mute/cam toggles, leave button, etc.) */}
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}