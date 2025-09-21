export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getUnreadCountsForUser, getUnreadCountsForUserDebug } from "@/lib/messages";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug");
    if (debug === "1") {
      const dbg = await getUnreadCountsForUserDebug();
      return NextResponse.json(dbg, { status: 200 });
    }
    const data = await getUnreadCountsForUser();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ totalUnread: 0, perConversation: {} }, { status: 500 });
  }
}
