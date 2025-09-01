export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(bearer ?? undefined);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: slotId } = await context.params;

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