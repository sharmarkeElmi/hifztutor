// app/api/slots/[id]/book/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  // must be signed in
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const slotId = params.id;

  // 1) Read slot and verify it's held by this user and still valid
  const { data: slot, error: fetchErr } = await supabase
    .from("lesson_slots")
    .select("id,tutor_id,starts_at,ends_at,price_cents,held_by,hold_expires_at,status")
    .eq("id", slotId)
    .single();

  if (fetchErr || !slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  // check status/ownership/expiry
  const now = Date.now();
  const holdOk =
    slot.held_by === user.id &&
    slot.hold_expires_at &&
    new Date(slot.hold_expires_at).getTime() > now;

  if (!holdOk) {
    return NextResponse.json(
      { error: "Hold has expired or you do not own this hold." },
      { status: 409 }
    );
  }

  // 2) UPDATE the slot to booked (do NOT insert or upsert)
  const { data: updatedSlot, error: updErr } = await supabase
    .from("lesson_slots")
    .update({ status: "booked" })
    .eq("id", slotId)
    .select("id,tutor_id,starts_at,ends_at,price_cents,status")
    .single();

  if (updErr || !updatedSlot) {
    // If you see an RLS error here, it means the UPDATE wasn’t permitted.
    // Ensure your policy allows UPDATE when held_by = auth.uid()
    return NextResponse.json(
      { error: updErr?.message ?? "Failed to book slot" },
      { status: 403 }
    );
  }

  // 3) Create a booking record for this user
  const { data: booking, error: insErr } = await supabase
    .from("bookings")
    .insert({
      slot_id: updatedSlot.id,
      student_id: user.id,
      tutor_id: updatedSlot.tutor_id,
      starts_at: updatedSlot.starts_at,
      ends_at: updatedSlot.ends_at,
      price_cents: updatedSlot.price_cents ?? 0,
      status: "pending_payment", // or "confirmed" if you want to skip payments for now
    })
    .select("id, status, slot_id")
    .single();

  if (insErr || !booking) {
    return NextResponse.json(
      { error: insErr?.message ?? "Failed to create booking" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { message: "Booked", booking, slot: updatedSlot },
    { status: 200 }
  );
}