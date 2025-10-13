export const runtime = "nodejs";

/**
 * Student — Dashboard
 * - Server-side auth + role guard (Next 15 SSR)
 * - Pulls upcoming lessons from Supabase
 * - Provides quick entry points into the next LiveKit room
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type LessonRow = {
  id: string;
  room_name: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string | null;
  tutor: {
    full_name: string | null;
    display_name: string | null;
    email: string | null;
  } | null;
};

type UpcomingLesson = {
  id: string;
  roomName: string;
  start: Date;
  end: Date | null;
  tutorName: string;
  status: "scheduled" | "in_progress";
};

const DEFAULT_DURATION_MINUTES = 60;

const formatDateTime = (value: Date | null) =>
  value
    ? value.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBD";

export default async function StudentDashboardPage() {
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

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    redirect(`/signin?next=${encodeURIComponent("/student/dashboard")}`);
  }

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

  const nowIso = new Date().toISOString();
  const { data: lessonsData } = await supabase
    .from("lessons")
    .select(
      `
        id,
        room_name,
        scheduled_at,
        duration_minutes,
        status,
        tutor:profiles!lessons_tutor_id_fkey(full_name, display_name, email)
      `
    )
    .eq("student_id", user.id)
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  const lessonsRows: LessonRow[] =
    lessonsData?.map((row) => ({
      id: row.id,
      room_name: row.room_name,
      scheduled_at: row.scheduled_at ?? null,
      duration_minutes:
        typeof row.duration_minutes === "number" ? row.duration_minutes : null,
      status: typeof row.status === "string" ? row.status : null,
      tutor: Array.isArray(row.tutor) ? row.tutor[0] ?? null : (row.tutor ?? null),
    })) ?? [];

  const lessons: UpcomingLesson[] = lessonsRows
    .map((lesson) => {
      if (!lesson.scheduled_at) return null;
      const start = new Date(lesson.scheduled_at);
      if (Number.isNaN(start.getTime())) return null;

      const durationMinutes = lesson.duration_minutes ?? DEFAULT_DURATION_MINUTES;
      const end = Number.isFinite(durationMinutes)
        ? new Date(start.getTime() + durationMinutes * 60_000)
        : null;
      const tutorName =
        lesson.tutor?.full_name ??
        lesson.tutor?.display_name ??
        lesson.tutor?.email ??
        "Tutor";

      const status = (lesson.status ?? "scheduled") as UpcomingLesson["status"];

      return {
        id: lesson.id,
        roomName: lesson.room_name,
        start,
        end,
        tutorName,
        status,
      };
    })
    .filter(Boolean) as UpcomingLesson[];

  const nextLesson = lessons[0] ?? null;
  const sevenDaysOut = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  })();

  const lessonsThisWeekCount = lessons.filter(
    (lesson) => lesson.start <= sevenDaysOut
  ).length;

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* Greeting */}
        <div className="relative overflow-hidden rounded-xl border bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back{fullName ? `, ${fullName}` : ""}!
          </h1>
          <p className="mt-1 text-slate-600">
            Plan, join, and track your Hifz progress in one place.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/lesson/join"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[#111629]"
              style={{ backgroundColor: "#F7D250" }}
            >
              Join a room
            </Link>
            <Link
              href="/student/lessons"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Review Lessons
            </Link>
            <p className="ml-auto text-sm">
              <Link
                href="/student/profile"
                className="text-blue-600 hover:underline"
              >
                Manage profile &amp; preferences
              </Link>
            </p>
          </div>
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10"
            style={{ background: "#D3F501" }}
          />
        </div>

        {/* Today’s Overview */}
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Today’s Overview</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Next lesson</p>
              <p className="mt-1 font-medium">
                {nextLesson ? formatDateTime(nextLesson.start) : "No lesson scheduled"}
              </p>
              {nextLesson && (
                <Link
                  href={`/lesson/${nextLesson.roomName}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm"
                  style={{ color: "#F7D250" }}
                >
                  Join now →
                </Link>
              )}
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Upcoming this week</p>
              <p className="mt-1 font-medium">{lessonsThisWeekCount}</p>
              <div
                className="mt-2 h-1.5 w-full rounded-full"
                style={{ background: "#CDD5E0" }}
              >
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${Math.min(100, lessonsThisWeekCount * 35)}%`,
                    background: "#F7D250",
                  }}
                />
              </div>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Study partner</p>
              <p className="mt-1 font-medium">
                {nextLesson ? `${nextLesson.tutorName} (Tutor)` : "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Stay consistent — small steps daily.
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Summary & Quick Start */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h2 className="mb-3 text-lg font-semibold">Weekly Summary</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>Sessions scheduled</span>
                <span className="font-medium">{lessonsThisWeekCount}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Total study time</span>
                <span className="font-medium">
                  {lessonsThisWeekCount > 0
                    ? `${lessonsThisWeekCount * DEFAULT_DURATION_MINUTES} mins`
                    : "—"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Average focus score</span>
                <span className="font-medium">—</span>
              </li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="mb-3 text-lg font-semibold">Quick Start Checklist</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  defaultChecked
                />
                <span>Verify your profile details</span>
              </li>
              <li className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Set your weekly study goals</span>
              </li>
              <li className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>Bookmark your favourite Mushaf</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Next Lesson */}
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-lg font-semibold">Your next lesson</h2>
          {nextLesson ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  With <span className="underline">{nextLesson.tutorName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(nextLesson.start)}
                  {nextLesson.end ? ` — ${formatDateTime(nextLesson.end)}` : ""}
                </p>
              </div>
              <Link
                href={`/lesson/${nextLesson.roomName}`}
                className="mt-2 inline-flex items-center justify-center rounded px-4 py-2 text-[#111629] sm:mt-0"
                style={{ backgroundColor: "#F7D250" }}
              >
                {nextLesson.status === "in_progress" ? "Rejoin Room" : "Join Room"}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming lessons. Book one to get started.
            </p>
          )}
        </div>

        {/* Upcoming Lessons */}
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Upcoming lessons</h2>
          {lessons.length ? (
            <ul className="divide-y">
              {lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {formatDateTime(lesson.start)}
                      {lesson.end ? ` — ${formatDateTime(lesson.end)}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      With {lesson.tutorName}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {lesson.status === "in_progress" ? "In progress" : "Scheduled"}
                    </p>
                  </div>
                  <Link
                    href={`/lesson/${lesson.roomName}`}
                    className="inline-flex items-center justify-center rounded px-3 py-1.5 text-[#111629]"
                    style={{ backgroundColor: "#F7D250" }}
                  >
                    {lesson.status === "in_progress" ? "Rejoin" : "Join"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No lessons scheduled this week.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
