export const runtime = 'nodejs';

/**
 * Tutor — Dashboard (SSR)
 * -----------------------------------------
 * - Server-side Supabase auth + role guard (Next 15)
 * - Uses shared <Shell role="tutor" activeKey="overview"> for chrome
 * - Keeps the same greeting + quick actions layout
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import Shell from "../../components/dashboard/Shell";

export default async function TutorDashboardPage() {
  // Next.js 15: cookies() must be awaited
  const cookieStore = await cookies();

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
    }
  );

  // Auth guard
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    redirect("/tutor/signin");
  }

  // Profile + role guard (self-heal minimal: if role not tutor, redirect to student)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; role: string | null }>();

  const fullName = profile?.full_name ?? null;
  const role = profile?.role ?? null;

  if (role && role !== "tutor") {
    // If their profile says student, send them to the student dashboard
    redirect("/student/dashboard");
  }

  return (
    <Shell role="tutor" activeKey="overview">
      {/* Header / greeting */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tutor Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {fullName || user.email}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View public profile */}
          <Link
            href={`/tutors/${user.id}`}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            View public profile
          </Link>

          {/* Edit tutor profile */}
          <Link
            href="/tutor/profile"
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Edit profile
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-white">
          <h2 className="font-medium mb-2">Quick actions</h2>
          <Link
            href="/lesson/join"
            className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Join a live lesson
          </Link>
        </div>

        {/* Placeholder cards to make the grid feel balanced; can be filled later */}
        <div className="rounded-lg border p-4 bg-white">
          <h3 className="font-medium mb-1">Today</h3>
          <p className="text-sm text-muted-foreground">No lessons scheduled.</p>
        </div>
        <div className="rounded-lg border p-4 bg-white">
          <h3 className="font-medium mb-1">Earnings</h3>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </div>
      </div>

      {/* Upcoming lessons */}
      <div className="rounded-lg border p-4 bg-white mt-6">
        <h2 className="text-lg font-semibold mb-2">Upcoming lessons to teach</h2>
        <p className="text-sm text-muted-foreground">
          You have no lessons scheduled. Accept a booking to get started.
        </p>
      </div>
    </Shell>
  );
}