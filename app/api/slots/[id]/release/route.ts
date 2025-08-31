import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type RouteParams = { params: { id: string } };

export async function POST(_req: Request, { params }: RouteParams) {
const cookieStore = cookies(); // no await here
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : JSON.stringify(err);
    console.error("Slot release error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}