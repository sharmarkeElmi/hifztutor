// app/lesson/[room]/page.tsx
// ==========================================
// Server component wrapper for a LiveKit room.
// - Reads the room name from the dynamic route.
// - Reads LIVEKIT_URL server-side (keeps env off client bundle).
// - Renders the client component that actually joins the room.
// ==========================================

import RoomClient from "./room-client";

type PageProps = {
  params: { room: string };
};

export default function LessonRoomPage({ params }: PageProps) {
  const livekitUrl = process.env.LIVEKIT_URL; // safe to read on server

  if (!livekitUrl) {
    // Helpful error for misconfigured env
    return (
      <div className="max-w-xl mx-auto mt-10">
        <h1 className="text-2xl font-semibold">Live lesson room</h1>
        <p className="mt-2 text-red-600">
          LIVEKIT_URL is not set. Add it to your .env.local and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <RoomClient roomName={params.room} livekitUrl={livekitUrl} />
  );
}