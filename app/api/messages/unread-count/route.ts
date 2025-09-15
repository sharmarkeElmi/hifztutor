export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getUnreadCountsForUser } from "@/lib/messages";

export async function GET() {
  const data = await getUnreadCountsForUser();
  return NextResponse.json(data);
}

