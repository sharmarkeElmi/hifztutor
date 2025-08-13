// app/api/livekit-token/route.ts
import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const lkUrl = process.env.LIVEKIT_URL;
  const lkKey = process.env.LIVEKIT_API_KEY;
  const lkSecret = process.env.LIVEKIT_API_SECRET;

  console.log("Loaded env vars:", {
    supabaseUrl: supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
    supabaseServiceKey: supabaseServiceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    lkUrl: lkUrl ? "LIVEKIT_URL" : null,
    lkKey: lkKey ? "LIVEKIT_API_KEY" : null,
    lkSecret: lkSecret ? "LIVEKIT_API_SECRET" : null,
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server misconfig: Supabase env vars missing (URL or SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }
  if (!lkUrl || !lkKey || !lkSecret) {
    return NextResponse.json(
      { error: "Server misconfig: LiveKit env vars missing (LIVEKIT_URL/API_KEY/API_SECRET)." },
      { status: 500 }
    );
  }

  // Extract bearer token from Authorization header or query parameter
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  const url = new URL(request.url);
  const qpToken = url.searchParams.get("access_token");
  const token = bearer || qpToken || null;

  console.log("Bearer token found:", Boolean(token));

  if (!token) {
    return NextResponse.json({ error: "Unauthorized: missing token" }, { status: 401 });
  }

  // Verify Supabase access token using service role
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);

  const verified = !userErr && !!userData?.user;
  console.log("User verification succeeded:", verified);

  if (!verified) {
    return NextResponse.json(
      { error: "Unauthorized: invalid session (could not verify bearer)" },
      { status: 401 }
    );
  }

  // Extract required params
  const roomName = url.searchParams.get("room");
  const username = url.searchParams.get("username");
  const displayName = url.searchParams.get("displayName") ?? userData.user.email ?? null;

  if (!roomName || !username) {
    return NextResponse.json({ error: "Missing room or username" }, { status: 400 });
  }

  // Ensure username matches authenticated user ID
  if (username !== userData.user.id) {
    return NextResponse.json({ error: "Username mismatch" }, { status: 403 });
  }

  // Generate LiveKit token
  const at = new AccessToken(lkKey, lkSecret, {
    identity: username,
    name: displayName ?? undefined,
    ttl: "2h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const lkToken = await at.toJwt();
  return NextResponse.json({ token: lkToken });
}