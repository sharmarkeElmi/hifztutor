export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tutorId?: string }> }
) {
  const { tutorId } = await context.params;
  if (!tutorId) {
    return NextResponse.json({ error: "Missing tutorId" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from("tutor_availability_patterns")
    .select("hours_by_dow, timezone")
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    hours_by_dow: data?.hours_by_dow ?? null,
    timezone: data?.timezone ?? null,
  });
}
