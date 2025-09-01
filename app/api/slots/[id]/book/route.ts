export const runtime = 'nodejs';

// app/api/slots/[id]/book/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type SlotRow = {
  id: string;
  tutor_id: string;
  starts_at: string;
  ends_at: string;
  price_cents: number | null;
  status: string;
  held_by: string | null;
  hold_expires_at: string | null;
};

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Next.js 15: await cookies()
  const cookieStore = await cookies();

  // Support auth via Authorization header in addition to cookies
  const authHeader = _req.headers.get('authorization');
  const bearer = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
      global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
    }
  );

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(bearer ?? undefined);
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: slotId } = await context.params;

  // Read slot details (DB trigger/book_slot_tx enforces atomic availability during INSERT)
  const { data: slotRow, error: slotErr } = await supabase
    .from("lesson_slots")
    .select("id,tutor_id,starts_at,ends_at,price_cents,status,held_by,hold_expires_at")
    .eq("id", slotId)
    .single<SlotRow>();

  if (slotErr || !slotRow) {
    return NextResponse.json({ error: slotErr?.message || "Slot not found" }, { status: 400 });
  }

  // Create booking record (DB trigger/book_slot_tx enforces atomic availability & transitions)
  const { data: booking, error: insErr } = await supabase
    .from("bookings")
    .insert({
      slot_id: slotRow.id,
      tutor_id: slotRow.tutor_id,
      student_id: user.id,
      starts_at: slotRow.starts_at,
      ends_at: slotRow.ends_at,
      price_cents: slotRow.price_cents ?? 0,
      status: "confirmed",
    })
    .select("id,slot_id,tutor_id,student_id,starts_at,ends_at,price_cents,status,created_at")
    .single();

  if (insErr) {
    return NextResponse.json(
      { error: "Something went wrong while booking this slot. Please try again." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "Booked",
    booking,
    slot: {
      id: slotRow.id,
      tutor_id: slotRow.tutor_id,
      starts_at: slotRow.starts_at,
      ends_at: slotRow.ends_at,
      price_cents: slotRow.price_cents,
      status: "booked",
    },
  });
}