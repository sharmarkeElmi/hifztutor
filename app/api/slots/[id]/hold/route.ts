// app/api/slots/[id]/hold/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type RouteParams = { params: { id: string } };

export async function POST(_req: Request, { params }: RouteParams) {
  // Next.js dynamic cookies API must be awaited in your version
const cookieStore = cookies(); // no await here
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // 1) Require an authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Auth session missing!" }, { status: 401 });
    }

    const slotId = params.id;
    const nowIso = new Date().toISOString();
    const holdUntilIso = new Date(Date.now() + 5 * 60_000).toISOString(); // 5 minutes

    // 2) Atomically set the hold if the slot is still open and in the future
    const { data: slot, error: upErr } = await supabase
      .from("lesson_slots")
      .update({
        status: "held",
        held_by: user.id,
        hold_expires_at: holdUntilIso,
      })
      .eq("id", slotId)
      .eq("status", "open")
      .gt("starts_at", nowIso)
      .select(
        "id, tutor_id, starts_at, ends_at, price_cents, status, held_by, hold_expires_at"
      )
      .single();

    if (upErr) {
      const msg = String(upErr.message ?? upErr);
      if (msg.includes("No rows")) {
        return NextResponse.json({ error: "Slot not available" }, { status: 409 });
      }
      throw upErr;
    }

    if (!slot) {
      return NextResponse.json({ error: "Slot not available" }, { status: 409 });
    }

    return NextResponse.json({
      message: "Slot held",
      slot,
      hold_expires_at: holdUntilIso,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : JSON.stringify(err);
    console.error("Slot hold error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}