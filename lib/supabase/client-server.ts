// lib/supabase/client-server.ts
// Server/route handler Supabase client factory using @supabase/ssr with Next cookies()

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type Options = {
  readOnly?: boolean;
};

export async function createSupabaseServerClient({ readOnly }: Options = {}) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, cookieOptions: CookieOptions) {
          if (readOnly) return;
          cookieStore.set({ name, value, ...cookieOptions });
        },
        remove(name: string, cookieOptions: CookieOptions) {
          if (readOnly) return;
          cookieStore.set({ name, value: "", ...cookieOptions });
        },
      },
    }
  );
}
