// app/api/slots/[id]/release/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  // Pass an async function so the helper receives a Promise<ReadonlyRequestCookies>
  const supabase = createRouteHandlerClient({
    cookies: async () => {
      // Next 15 requires awaiting cookies() before anyone reads from it
      return await cookies();
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Auth session missing!" }, { status: 401 });
    }

    const slotId = params.id;

    const { error: upErr } = await supabase
      .from("lesson_slots")
      .update({
        status: "available",
        held_by: null,
        hold_expires_at: null,
      })
      .eq("id", slotId)
      .eq("held_by", user.id);

    if (upErr) throw upErr;

    return NextResponse.json({ message: "Slot released" });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    console.error("Slot release error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}