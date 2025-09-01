// lib/supabase.ts
// Client-side helper consistent with Next.js 15 and our @supabase/ssr usage.
// Use this in client components instead of a module-scoped singleton.

import { createBrowserClient } from "@supabase/ssr";

export const createSupabaseBrowserClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );