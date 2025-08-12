"use client";

/**
 * Client-side LiveKit room component
 * -----------------------------------------
 * Responsibilities:
 *  - Verify the user is signed in (via Supabase).
 *  - Load a friendly display name from `profiles.full_name` (fallback to email).
 *  - Request a LiveKit access token from our API route.
 *  - Connect to LiveKit Cloud and render a ready-made video UI.
 *  - Provide basic controls (mic/cam/leave) via <VideoConference />.
 *
 * Notes:
 *  - Identity passed to LiveKit must be unique → we use the Supabase user.id UUID,
 *    but we do NOT need to store it in state here (it’s embedded in the token).
 *  - We keep LIVEKIT_URL out of the client bundle by passing it from the server page.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// LiveKit React components + default styles
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

type Props = {
  roomName: string;
  livekitUrl: string;
};

export default function RoomClient({ roomName, livekitUrl }: Props) {
  const router = useRouter();

  // Local UI state
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>(""); // shown in UI

  const leaveTo = "/student/dashboard";

  useEffect(() => {
    let active = true;

    (async () => {
      // 1) Check auth
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        // Not signed in → choose student sign-in by default
        router.replace("/student/signin");
        return;
      }

      const user = session.user;

      // 2) Load profile name (friendly display name)
      let name = user.email ?? "Guest";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.full_name) name = profile.full_name;

      // 3) Build identity (unique, stable) and fetch a LiveKit token from our API
      const uniqueIdentity = user.id; // UUID is perfect for LiveKit identity

      const params = new URLSearchParams({
        room: roomName,
        username: uniqueIdentity, // identity the server will embed in token
      });

      const res = await fetch(`/api/livekit-token?${params.toString()}`, {
        method: "GET",
      });

      if (!active) return;

      if (!res.ok) {
        setLoading(false);
        return;
      }
      const { token } = await res.json();

      if (!active) return;

      setDisplayName(name);
      setToken(token);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [roomName, router]);

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

  return (
    <div className="h-[calc(100vh-100px)]">
      {/* 
        LiveKitRoom handles connection lifecycle given a token & server URL.
        - `connect` automatically connects on mount
        - `audio`/`video` as true enables publishing by default
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
        /* Note: avoid passing custom props like data-lk-user-name directly to
           LiveKitRoom because TypeScript will flag them. The participant name
           is typically derived from the token on the server side. */
      >
        {/* Ready-made conferencing UI with tiles, mute/cam toggles, leave button, etc. */}
        <VideoConference />

        {/* If you want a custom UI later, you can replace <VideoConference /> with your own layout:
           - Use hooks like `useTracks()` and components like <ParticipantTile /> from the same library.
        */}
      </LiveKitRoom>
    </div>
  );
}