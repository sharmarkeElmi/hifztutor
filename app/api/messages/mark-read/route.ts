export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { conversationId?: string };
    const conversationId = (body?.conversationId || "").trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!conversationId || !uuidRe.test(conversationId)) {
      return NextResponse.json({ ok: false, error: "invalid conversationId" }, { status: 400 });
    }

    // Attempt to update stamp; do not insert here (avoid recursion/policy issues)
    const { data, error } = await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .select("conversation_id,user_id,last_read_at")
      .maybeSingle();
    if (error) {
      const msg = process.env.NODE_ENV !== 'production' ? `update failed: ${error.message}` : 'update failed';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "membership not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, membership: data });
  } catch {
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}
