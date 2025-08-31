// app/api/slots/[id]/hold/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: slotId } = await params;
  try {
    // Hand the cookies FUNCTION to the helper (do NOT call cookies() here)
    const supabase = createRouteHandlerClient({ cookies });

    // Require a signed-in user
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const nowIso = new Date().toISOString();
    const holdForMinutes = 10;
    const expiresIso = new Date(Date.now() + holdForMinutes * 60_000).toISOString();

    // Place a hold only if the slot is still available and in the future
    const { data: slot, error } = await supabase
      .from("lesson_slots")
      .update({
        status: "held",
        held_by: user.id,
        hold_expires_at: expiresIso,
      })
      .eq("id", slotId)
      .eq("status", "available")
      .gt("starts_at", nowIso)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (!slot) {
      return NextResponse.json(
        { error: "Slot is no longer available. Please pick another time." },
        { status: 409 }
      );
    }

    return NextResponse.json({ slot, hold_expires_at: expiresIso }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}