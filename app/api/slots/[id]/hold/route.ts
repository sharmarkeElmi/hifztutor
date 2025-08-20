import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server-side Supabase client factory using request cookies
async function createSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabase();

  // Identify the current user from auth cookies
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const slotId = params.id;
  const nowIso = new Date().toISOString();
  const holdUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Atomically claim the slot if it's open and not held (or hold expired)
  const { data, error } = await supabase
    .from("lesson_slots")
    .update({
      held_by: user.id,
      hold_expires_at: holdUntil.toISOString(),
    })
    .eq("id", slotId)
    .eq("status", "open")
    // Either no one holds it, or the previous hold is expired
    .or(`held_by.is.null,hold_expires_at.lt.${nowIso}`)
    .select("id, tutor_id, starts_at, ends_at, price_cents, held_by, hold_expires_at, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Slot not available" }, { status: 409 });
  }

  return NextResponse.json({
    message: "Slot held",
    slot: data,
    hold_expires_at: holdUntil.toISOString(),
  });
}