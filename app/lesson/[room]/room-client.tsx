"use client";

/**
 * LiveKit Room (client)
 * - Requires Supabase sign-in
 * - Loads role + name from profiles
 * - Requests a LiveKit token (server-verified)
 * - Connects to LiveKit Cloud and renders the stock conference UI
 * - Polished: adds a slim header (room, role, name, leave)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
            const remotes = (room as LiveKitRoomType | undefined)?.remoteParticipants?.size ?? 0;
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
        } catch { }
        window.location.assign(leaveTo);
    };

    return (
        <div className="mb-3 rounded-md border bg-white/80 backdrop-blur px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                    Room: <span className="ml-1 font-medium">{roomName}</span>
                </span>
                <span className="inline-flex items-center rounded-full border px-2 py-0.5">
                    Role: <span className="ml-1 font-medium capitalize">{role}</span>
                </span>
                <span className="hidden sm:inline text-muted-foreground">•</span>
                <span className="truncate" title={displayName}>
                    Signed in as <span className="font-medium">{displayName}</span>
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-sm" title="Participants in call">
                    <span className="mr-1">Participants:</span>
                    <span className="font-medium">{participantCount}</span>
                </span>
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-sm" title="Time in call">
                    <span className="mr-1">In call:</span>
                    <span className="font-medium">{formatDuration(elapsed)}</span>
                </span>
                <button
                    onClick={handleLeave}
                    className="inline-flex items-center justify-center rounded bg-red-600 px-3 py-1.5 text-white text-sm hover:bg-red-700"
                >
                    Leave
                </button>
            </div>
        </div>
    );
}

export default function RoomClient({ roomName, livekitUrl }: Props) {
    const router = useRouter();

    // UI state
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string>("");
    const [leaveTo, setLeaveTo] = useState<string>("/student/dashboard");
    const [role, setRole] = useState<"student" | "tutor">("student"); // NEW: for header badge
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
            const roleVal = (profile?.role as "student" | "tutor" | null) ?? "student";
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
    }, [roomName, router]);

    // Loading & error UI
    if (loading) {
        return <p className="text-center mt-10">Preparing your room…</p>;
    }

    if (!token) {
        return (
            <div className="max-w-xl mx-auto mt-10 space-y-3">
                <h1 className="text-2xl font-semibold">Couldn&apos;t join the room</h1>
                <p className="text-muted-foreground">
                    {apiError
                        ? apiError
                        : "We weren&apos;t able to obtain a LiveKit token. Please try again."}
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

    // LiveKit video UI with header
    return (
        <div className="h-[calc(100vh-100px)] bg-gray-50">
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
                {/* Polished header above the stock conference UI */}
                <div className="px-2 pt-2">
                    <RoomHeader
                        roomName={roomName}
                        role={role}
                        displayName={displayName}
                        leaveTo={leaveTo}
                    />
                </div>

                {/* Stock, accessible conference UI (tiles, mute/cam toggles, leave button, etc.) */}
                <VideoConference />
            </LiveKitRoom>
        </div>
    );
}