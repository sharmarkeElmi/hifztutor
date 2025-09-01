export const runtime = 'nodejs';

/**
 * Student — Dashboard (clean MVP)
 * - Server-side auth + role guard (Next 15 SSR)
 * - Greeting (full name fallback to email)
 * - Quick actions route to Lessons & Inbox
 * - Next lesson + Upcoming lessons placeholders
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import DashboardShell from "../../components/dashboard/Shell";

// Placeholder lesson type
 type Lesson = {
  id: string;
  startsAt: string;
  endsAt: string;
  withName: string;
  roleOpposite: "Tutor" | "Student";
};

export default async function StudentDashboardPage() {
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
    redirect("/student/signin");
  }

  // Profile + role guard
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; role: string | null }>();

  const fullName = profile?.full_name ?? null;
  const role = profile?.role ?? null;

  if (role && role !== "student") {
    redirect("/tutor/dashboard");
  }

  // -------- Placeholder lessons (replace with DB later) --------
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const lessons: Lesson[] = [
    {
      id: "lsn_001",
      startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      withName: "Ustadh Ali",
      roleOpposite: "Tutor" as const,
    },
    {
      id: "lsn_002",
      startsAt: new Date(now.getTime() + dayMs + 4 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now.getTime() + dayMs + 5 * 60 * 60 * 1000).toISOString(),
      withName: "Fatimah",
      roleOpposite: "Student" as const,
    },
    {
      id: "lsn_003",
      startsAt: new Date(now.getTime() + 2 * dayMs).toISOString(),
      endsAt: new Date(now.getTime() + 2 * dayMs + 60 * 60 * 1000).toISOString(),
      withName: "Yusuf",
      roleOpposite: "Student" as const,
    },
  ].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const nextLesson = lessons[0] ?? null;

  const formatDT = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // -------- View --------
  return (
    <DashboardShell role="student">
      <div className="space-y-6 sm:space-y-8">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-xl border bg-white p-6 sm:p-7 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Welcome back{fullName ? `, ${fullName}` : ''}!
        </h1>
        <p className="text-slate-600 mt-1">Plan, join, and track your Hifz progress in one place.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {nextLesson ? (
            <Link
              href={`/lesson/${nextLesson.id}`}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[#111629]"
              style={{ backgroundColor: '#F7D250' }}
              aria-label={`Join room for next lesson with ${nextLesson.withName}`}
            >
              Join Next Room
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[#111629] opacity-50 cursor-not-allowed"
              style={{ backgroundColor: '#F7D250' }}
              disabled
              aria-disabled
              title="No upcoming lesson to join yet"
            >
              Join Next Room
            </button>
          )}
          <Link
            href="/student/lessons"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            Review Lessons
          </Link>
          <p className="text-sm ml-auto">
            <Link href="/student/profile" className="text-blue-600 hover:underline">
              Manage profile & preferences
            </Link>
          </p>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10" style={{ background: '#D3F501' }} />
      </div>


      {/* Today’s Overview */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Today’s Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Next lesson</p>
            <p className="mt-1 font-medium">
              {nextLesson ? `${formatDT(nextLesson.startsAt)}` : 'No lesson scheduled'}
            </p>
            {nextLesson && (
              <Link
                href={`/lesson/${nextLesson.id}`}
                className="mt-2 inline-flex text-sm items-center gap-1"
                style={{ color: '#F7D250' }}
              >
                Join now →
              </Link>
            )}
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Upcoming this week</p>
            <p className="mt-1 font-medium">{lessons.length}</p>
            <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: '#CDD5E0' }}>
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, lessons.length * 25)}%`, background: '#F7D250' }} />
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Study partner</p>
            <p className="mt-1 font-medium">{nextLesson ? `${nextLesson.withName} (${nextLesson.roleOpposite})` : '—'}</p>
            <p className="mt-2 text-xs text-muted-foreground">Stay consistent — small steps daily.</p>
          </div>
        </div>
      </div>

      {/* Weekly Summary & Quick Start */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Weekly Summary</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>Sessions completed</span>
              <span className="font-medium">2</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Total study time</span>
              <span className="font-medium">1h 45m</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Average focus score</span>
              <span className="font-medium">—</span>
            </li>
          </ul>
        </div>
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Quick Start Checklist</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
              <span>Verify your profile details</span>
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              <span>Set your weekly study goals</span>
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              <span>Bookmark your favorite Mushaf</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Next Lesson */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Your next lesson</h2>
        {nextLesson ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                With <span className="underline">{nextLesson.withName}</span> ({nextLesson.roleOpposite})
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDT(nextLesson.startsAt)} — {formatDT(nextLesson.endsAt)}
              </p>
            </div>
            {/* Keep a direct join here for convenience during MVP */}
            <Link
              href={`/lesson/${nextLesson.id}`}
              className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded px-4 py-2 text-[#111629]"
              style={{ backgroundColor: '#F7D250' }}
            >
              Join Room
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No upcoming lessons. Book one to get started.
          </p>
        )}
      </div>

      {/* Upcoming Lessons */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Upcoming lessons</h2>
        {lessons.length ? (
          <ul className="divide-y">
            {lessons.map((l) => (
              <li key={l.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {formatDT(l.startsAt)} — {formatDT(l.endsAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    With {l.withName} ({l.roleOpposite})
                  </p>
                </div>
                <Link
                  href={`/lesson/${l.id}`}
                  className="inline-flex items-center justify-center rounded px-3 py-1.5 text-[#111629]"
                  style={{ backgroundColor: '#F7D250' }}
                >
                  Join
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No lessons scheduled this week.</p>
        )}
      </div>
      </div>
    </DashboardShell>
  );
}