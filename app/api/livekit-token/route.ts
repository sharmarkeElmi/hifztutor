// app/api/livekit-token/route.ts
// =========================================
// This API route securely generates a LiveKit access token for the client.
// It ensures that the LiveKit API Secret stays on the server and never
// gets exposed to the browser.
// =========================================

import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get("room");
  const username = searchParams.get("username");
  const displayName = searchParams.get("displayName") ?? undefined;

  if (!roomName || !username) {
    return NextResponse.json({ error: "Missing room or username" }, { status: 400 });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: username, // must be unique per user
      name: displayName,  // friendly name for UI
      ttl: "2h",
    }
  );

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token });
}