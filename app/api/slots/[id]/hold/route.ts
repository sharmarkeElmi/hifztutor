export const runtime = 'nodejs';
// app/api/slots/[id]/hold/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type SlotRow = {
  id: string;
  status: string;
  held_by: string | null;
  hold_expires_at: string | null;
  starts_at: string;
  ends_at: string;
  price_cents: number | null;
  tutor_id: string;
};

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Next.js 15 requires awaiting cookies()
  const cookieStore = await cookies();

  // Accept Bearer token as a fallback if cookies are missing
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
      // Forward bearer token to Supabase client when present
      global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
    }
  );

  // Authenticate (uses bearer when provided)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(bearer ?? undefined);
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: slotId } = await context.params;
  const nowIso = new Date().toISOString();

  // Hold duration (in minutes)
  const holdForMinutes = 10;
  const expiresIso = new Date(Date.now() + holdForMinutes * 60_000).toISOString();

  // Atomically set the hold only if the slot is available and in the future
  const { data: slot, error } = await supabase
    .from('lesson_slots')
    .update({
      status: 'held',
      held_by: user.id,
      hold_expires_at: expiresIso,
    })
    .eq('id', slotId)
    .or(`status.eq.available,and(status.eq.held,held_by.eq.${user.id},hold_expires_at.gt.${nowIso})`)
    .gt('starts_at', nowIso)
    .select('id,status,held_by,hold_expires_at,starts_at,ends_at,price_cents,tutor_id')
    .maybeSingle<SlotRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!slot) {
    return NextResponse.json(
      { error: 'Sorry, someone else just reserved this time. Please pick another slot.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ slot, hold_expires_at: expiresIso }, { status: 200 });
}