export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function zonedDateToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const specifiedDate = new Date(utcDate.toLocaleString("en-US", { timeZone }));
  const offset = utcDate.getTime() - specifiedDate.getTime();
  return new Date(utcDate.getTime() + offset);
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!bearerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const { data: userData, error: userErr } = await admin.auth.getUser(bearerToken);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tutorId = user.id;

  const { data: patternRow, error: patternErr } = await admin
    .from("tutor_availability_patterns")
    .select("hours_by_dow, timezone")
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (patternErr) {
    return NextResponse.json({ error: patternErr.message }, { status: 500 });
  }

  const hoursByDow = (patternRow?.hours_by_dow ?? {}) as Record<string, number[]>;
  const hasAvailability = Object.values(hoursByDow).some((list) => Array.isArray(list) && list.length > 0);
  if (!hasAvailability) {
    return NextResponse.json({ created: 0, skipped: 0, message: "No availability set" }, { status: 200 });
  }

  const timezone = patternRow?.timezone || null;
  const { data: tutorProfile } = await admin
    .from("tutor_profiles")
    .select("time_zone, hourly_rate_cents")
    .eq("tutor_id", tutorId)
    .maybeSingle();
  const effectiveTimezone = timezone || tutorProfile?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const basePriceCents = typeof tutorProfile?.hourly_rate_cents === "number" ? tutorProfile.hourly_rate_cents : 0;

  const today = new Date();
  const rangeStartUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const rangeEndUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 21));

  const { data: existingSlots, error: slotsError } = await admin
    .from("lesson_slots")
    .select("id, starts_at, status")
    .eq("tutor_id", tutorId)
    .gte("starts_at", rangeStartUtc.toISOString())
    .lt("starts_at", rangeEndUtc.toISOString());

  if (slotsError) {
    return NextResponse.json({ error: slotsError.message }, { status: 500 });
  }

  const existingMap = new Set((existingSlots ?? []).map((slot: { starts_at: string }) => new Date(slot.starts_at).getTime()));
  const targetTimes = new Set<number>();

  const inserts: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 21; i++) {
    const dayUtc = new Date(rangeStartUtc.getTime());
    dayUtc.setUTCDate(dayUtc.getUTCDate() + i);

    const zoned = new Date(dayUtc.toLocaleString("en-US", { timeZone: effectiveTimezone }));
    const dayKey = zoned.getDay().toString();
    const hours = Array.isArray(hoursByDow[dayKey]) ? hoursByDow[dayKey] : [];
    if (!hours.length) continue;

    const year = zoned.getFullYear();
    const month = zoned.getMonth() + 1;
    const day = zoned.getDate();

    for (const hour of hours) {
      if (typeof hour !== "number" || hour < 0 || hour > 23) continue;
      const startDate = zonedDateToUtc(year, month, day, hour, effectiveTimezone);
      const endDate = zonedDateToUtc(year, month, day, hour + 1, effectiveTimezone);
      if (startDate < today) continue;
      const startTime = startDate.getTime();
      targetTimes.add(startTime);
      if (existingMap.has(startTime)) continue;

      inserts.push({
        id: randomUUID(),
        tutor_id: tutorId,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: "available",
        price_cents: basePriceCents,
        held_by: null,
        hold_expires_at: null,
      });
    }
  }

  let created = 0;
  if (inserts.length) {
    const { error: insertError } = await admin.from("lesson_slots").insert(inserts);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    created = inserts.length;
  }

  let removed = 0;
  if (existingSlots?.length) {
    const now = Date.now();
    const removableStatuses = new Set(["available", "held", "canceled"]);
    const toDelete = existingSlots.filter((slot) => {
      const time = new Date(slot.starts_at).getTime();
      if (time < now) return false;
      if (targetTimes.has(time)) return false;
      const status = typeof slot.status === "string" ? slot.status.toLowerCase() : "";
      return removableStatuses.has(status);
    });

    if (toDelete.length) {
      const { error: deleteError } = await admin
        .from("lesson_slots")
        .delete()
        .in(
          "id",
          toDelete.map((slot) => slot.id)
        );
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      removed = toDelete.length;
    }
  }

  return NextResponse.json({ created, removed, skipped: existingMap.size, timezone: effectiveTimezone });
}
