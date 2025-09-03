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

type Digest = "immediate" | "daily" | "weekly";

type NotificationsRow = {
  user_id: string;
  lesson_reminders: boolean;
  messages: boolean;
  receipts: boolean;
  product_updates: boolean;
  digest: Digest;
  quiet_hours: boolean;
};

const DEFAULTS: Omit<NotificationsRow, "user_id"> = {
  lesson_reminders: true,
  messages: true,
  receipts: true,
  product_updates: false,
  digest: "daily",
  quiet_hours: false,
};

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notification_settings")
    .select("lesson_reminders, messages, receipts, product_updates, digest, quiet_hours")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data ?? DEFAULTS);
}

export async function PUT(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await req.json()) as Partial<Omit<NotificationsRow, "user_id">>;

  const upsertRow: NotificationsRow = {
    user_id: user.id,
    lesson_reminders: payload.lesson_reminders ?? DEFAULTS.lesson_reminders,
    messages: payload.messages ?? DEFAULTS.messages,
    receipts: payload.receipts ?? DEFAULTS.receipts,
    product_updates: payload.product_updates ?? DEFAULTS.product_updates,
    digest: (payload.digest as Digest) ?? DEFAULTS.digest,
    quiet_hours: payload.quiet_hours ?? DEFAULTS.quiet_hours,
  };

  const { error } = await supabase
    .from("notification_settings")
    .upsert(upsertRow, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}