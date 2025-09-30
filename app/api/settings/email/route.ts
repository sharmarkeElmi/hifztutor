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

export async function POST(req: Request) {
  const supabase = await getSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { email?: string; currentEmail?: string };
  const email = (body.email ?? "").trim();
  const currentEmail = (body.currentEmail ?? "").trim();
  if (!currentEmail || currentEmail.toLowerCase() !== (user.email ?? "").trim().toLowerCase()) {
    return NextResponse.json({ error: "Current email does not match" }, { status: 400 });
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If email confirmations are enabled, Supabase will send a verification email
  return NextResponse.json({ ok: true, maybeVerificationRequired: true });
}
