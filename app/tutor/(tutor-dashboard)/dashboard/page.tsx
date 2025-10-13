export const runtime = "nodejs";

/**
 * Tutor — Dashboard
 * - Server-side Supabase auth + role guard (Next 15)
 * - Surfaces upcoming lessons to teach with quick join links
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
  student: {
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
  studentName: string;
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

export default async function TutorDashboardPage() {
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
    redirect(`/signin?next=${encodeURIComponent("/tutor/dashboard")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; role: string | null }>();

  const fullName = profile?.full_name ?? user.email ?? null;
  const role = profile?.role ?? null;

  if (role && role !== "tutor") {
    redirect("/student/dashboard");
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
        student:profiles!lessons_student_id_fkey(full_name, display_name, email)
      `
    )
    .eq("tutor_id", user.id)
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
      student: Array.isArray(row.student) ? row.student[0] ?? null : (row.student ?? null),
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
      const studentName =
        lesson.student?.full_name ??
        lesson.student?.display_name ??
        lesson.student?.email ??
        "Student";

      const status = (lesson.status ?? "scheduled") as UpcomingLesson["status"];

      return {
        id: lesson.id,
        roomName: lesson.room_name,
        start,
        end,
        studentName,
        status,
      };
    })
    .filter(Boolean) as UpcomingLesson[];

  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59
  );

  const lessonsTodayCount = lessons.filter(
    (lesson) => lesson.start >= startOfDay && lesson.start <= endOfDay
  ).length;

  return (
    <>
      <div className="relative mb-6 flex flex-wrap items-start justify-between gap-4 overflow-hidden rounded-xl border bg-white p-6 sm:p-7 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">Tutor Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {fullName ?? "Tutor"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/tutors/${user.id}`}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-gray-50"
          >
            View public profile
          </Link>
          <Link
            href="/tutor/profile"
            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-[#111629] shadow-sm"
            style={{ backgroundColor: "#F7D250" }}
          >
            Edit profile
          </Link>
        </div>

        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10"
          style={{ background: "#D3F501" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-medium">Actions</h2>
          <Link
            href="/lesson/join"
            className="inline-flex w-full items-center justify-center rounded px-4 py-2 text-[#111629]"
            style={{ backgroundColor: "#F7D250" }}
          >
            Join a room
          </Link>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-1 font-medium">Today</h3>
          <p className="text-sm text-muted-foreground">
            {lessonsTodayCount > 0
              ? `${lessonsTodayCount} lesson${lessonsTodayCount > 1 ? "s" : ""} booked`
              : "No lessons scheduled today."}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-1 font-medium">Classroom</h3>
          <p className="text-sm text-muted-foreground">
            Preview the new classroom experience and prepare your materials.
          </p>
          <Link
            href="/lesson/join"
            className="mt-3 inline-flex items-center rounded px-3 py-1.5 text-sm text-[#111629]"
            style={{ backgroundColor: "#F7D250" }}
          >
            Open classroom sandbox
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Upcoming lessons to teach</h2>
        {lessons.length ? (
          <ul className="mt-3 divide-y">
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
                    With {lesson.studentName}
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
                  {lesson.status === "in_progress" ? "Rejoin" : "Start lesson"}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            You have no lessons scheduled. Accept a booking to get started.
          </p>
        )}
      </div>
    </>
  );
}
