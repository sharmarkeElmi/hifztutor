// app/api/livekit-token/route.ts
// =========================================
// This API route securely generates a LiveKit access token for the client.
// It ensures that the LiveKit API Secret stays on the server and never
// gets exposed to the browser.
// =========================================

import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

// GET request handler — the client will request a token from here.
export async function GET(request: Request) {
  // Extract the "room" and "username" from the query string
  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get("room");
  const username = searchParams.get("username");

  // Basic validation
  if (!roomName || !username) {
    return NextResponse.json({ error: "Missing room or username" }, { status: 400 });
  }

  // Create a new LiveKit Access Token
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: username, // Unique identity for the participant
      ttl: "1h", // Token valid for 1 hour
    }
  );

  // Grant permission to join the specified room
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,  // Allow sending audio/video
    canSubscribe: true // Allow receiving audio/video
  });

  // Serialize to JWT
  const token = await at.toJwt();

  return NextResponse.json({ token });
}