// app/lesson/[room]/page.tsx
// ==========================================
// Server component wrapper for a LiveKit room.
// - Reads the room name from the dynamic route.
// - Reads LIVEKIT_URL server-side (keeps env off client bundle).
// - Renders the client component that actually joins the room.
// ==========================================

import RoomClient from "./room-client";

type PageProps = {
  // In Next.js App Router, params can be a Promise, so we type it accordingly
  params: Promise<{ room: string }>;
};

export default async function LessonRoomPage({ params }: PageProps) {
  // Await params because in Next.js App Router, route params can be async
  const { room } = await params;

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
    <RoomClient roomName={room} livekitUrl={livekitUrl} />
  );
}