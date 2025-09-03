import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type ProfilePayload = {
  fullName?: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  languages?: string[] | string | null; // array or CSV; null clears
};

function normalizeLanguages(input: ProfilePayload["languages"]): string[] | null {
  if (input == null) return null;
  if (Array.isArray(input)) {
    const arr = input.map((s) => (s ?? "").toString().trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  if (typeof input === "string") {
    const arr = input.split(",").map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  return null;
}

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

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, timezone, locale, languages")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    fullName: data?.full_name ?? "",
    avatarUrl: data?.avatar_url ?? "",
    timezone: data?.timezone ?? "",
    locale: data?.locale ?? "",
    languages: data?.languages ?? [],
  });
}

export async function PUT(req: Request) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as ProfilePayload;
  const languages = normalizeLanguages(body.languages);

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: body.fullName ?? null,
      avatar_url: body.avatarUrl ?? null,
      timezone: body.timezone ?? null,
      locale: body.locale ?? null,
      languages,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}