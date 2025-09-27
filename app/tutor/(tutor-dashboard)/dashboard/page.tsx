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
import { createServerClient } from "@supabase/ssr";

export default async function TutorDashboardPage() {
  // Next.js 15: cookies() must be awaited
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // In Server Components, avoid writing cookies here.
        set() {},
        remove() {},
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
    <>
      {/* Header / greeting */}
      <div className="mb-6 relative overflow-hidden rounded-xl border bg-white p-6 sm:p-7 shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tutor Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {fullName || user.email}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View public profile */}
          <Link
            href={`/tutors/${user.id}`}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
          >
            View public profile
          </Link>

          {/* Edit tutor profile */}
          <Link
            href="/tutor/profile"
            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-[#111629] shadow-sm"
            style={{ backgroundColor: '#F7D250' }}
          >
            Edit profile
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10" style={{ background: '#D3F501' }} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-white">
          <h2 className="font-medium mb-2">Actions</h2>
          <Link
            href="/lesson/join"
            className="inline-flex items-center justify-center rounded px-4 py-2 text-[#111629]"
            style={{ backgroundColor: '#F7D250' }}
          >
            Join a live lesson
          </Link>
        </div>

        {/* Placeholder cards to make the grid feel balanced; can be filled later */}
        <div className="rounded-lg border p-4 bg-white">
          <h3 className="font-medium mb-1">Today</h3>
          <p className="text-sm text-muted-foreground">No lessons scheduled.<br />Stay available to receive bookings.</p>
        </div>
        <div className="rounded-lg border p-4 bg-white">
          <h3 className="font-medium mb-1">Earnings</h3>
          <p className="text-sm text-muted-foreground">Coming soon — track payouts and hourly totals.</p>
        </div>
      </div>

      {/* Upcoming lessons */}
      <div className="rounded-lg border p-4 bg-white mt-6">
        <h2 className="text-lg font-semibold mb-2">Upcoming lessons to teach</h2>
        <p className="text-sm text-muted-foreground">
          You have no lessons scheduled. Accept a booking to get started.
        </p>
      </div>
    </>
  );
}
