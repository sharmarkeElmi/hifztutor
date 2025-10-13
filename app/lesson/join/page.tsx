export const runtime = "nodejs";

/**
 * Lesson — Join Page
 * Lists upcoming lessons for the signed-in tutor/student and provides
 * one-click join links. Includes a manual room entry fallback.
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ManualJoinForm } from "./manual-join-form";
import DashboardShell from "@/app/components/shells/DashboardShell";

type Role = "student" | "tutor";

type ProfileStub = {
  full_name: string | null;
  display_name: string | null;
  email: string | null;
};

type LessonRow = {
  id: string;
  room_name: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string | null;
  tutor: ProfileStub | null;
  student: ProfileStub | null;
};

type UpcomingLesson = {
  id: string;
  roomName: string;
  start: Date;
  end: Date | null;
  counterpartName: string;
  status: string;
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

function getDisplayName(profile: ProfileStub | null): string | null {
  if (!profile) return null;
  return profile.full_name ?? profile.display_name ?? profile.email;
}

export default async function JoinLessonPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
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
    redirect(`/signin?next=${encodeURIComponent("/lesson/join")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role | null }>();

  const role = profile?.role ?? null;

  if (role !== "student" && role !== "tutor") {
    return (
      <section className="mx-auto mt-12 max-w-2xl rounded-xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-[#111629]">
          Set up your profile first
        </h1>
        <p className="mt-3 text-slate-600">
          We couldn&apos;t determine whether you&apos;re a tutor or a student yet.
          Please complete your profile so we can route you to the right lesson room.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/student/profile"
            className="inline-flex items-center rounded px-4 py-2 text-[#111629]"
            style={{ backgroundColor: "#F7D250" }}
          >
            Go to profile settings
          </Link>
        </div>
      </section>
    );
  }

  const nowIso = new Date().toISOString();
  const baseQuery = supabase
    .from("lessons")
    .select(
      `
        id,
        room_name,
        scheduled_at,
        duration_minutes,
        status,
        tutor:profiles!lessons_tutor_id_fkey(full_name, display_name, email),
        student:profiles!lessons_student_id_fkey(full_name, display_name, email)
      `
    )
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(15);

  const filteredQuery =
    role === "tutor"
      ? baseQuery.eq("tutor_id", user.id)
      : baseQuery.eq("student_id", user.id);

  const { data: lessonsData } = await filteredQuery;
  const lessonsRows: LessonRow[] =
    lessonsData?.map((row) => ({
      id: row.id,
      room_name: row.room_name,
      scheduled_at: row.scheduled_at ?? null,
      duration_minutes:
        typeof row.duration_minutes === "number" ? row.duration_minutes : null,
      status: typeof row.status === "string" ? row.status : null,
      tutor: Array.isArray(row.tutor) ? row.tutor[0] ?? null : (row.tutor ?? null),
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

      const counterpartName =
        role === "tutor"
          ? getDisplayName(lesson.student)
          : getDisplayName(lesson.tutor);

      return {
        id: lesson.id,
        roomName: lesson.room_name,
        start,
        end,
        counterpartName: counterpartName ?? (role === "tutor" ? "Student" : "Tutor"),
        status: lesson.status ?? "scheduled",
      };
    })
    .filter(Boolean) as UpcomingLesson[];

  const activeNav = role === "tutor" ? "classroom" : "lessons";

  const explicitRoom =
    typeof searchParams?.room === "string" && searchParams.room.trim()
      ? searchParams.room.trim()
      : null;

  const suggestedRoom = explicitRoom ?? lessons[0]?.roomName ?? null;

  return (
    <DashboardShell
      role={role}
      activeKey={activeNav}
      contentClassName="py-8"
    >
      <div className="mx-auto max-w-3xl space-y-8">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#111629]">Join your lesson</h1>
        <p className="mt-2 text-sm text-slate-600">
          {lessons.length
            ? `Here are the upcoming lessons you're ${
                role === "tutor" ? "teaching" : "attending"
              }.`
            : `No upcoming lessons found. Once a lesson is scheduled ${
                role === "tutor" ? "with a student" : "with your tutor"
              }, it will show up here.`}
        </p>
        <div className="mt-4 rounded-lg border border-[#F7D250]/50 bg-[#FFF7D6] px-4 py-3 text-sm text-[#111629] shadow-sm">
          <p className="font-medium">
            Quick test: pick a room name and share it with your tutor or student.
          </p>
          <p className="mt-1 text-[#111629]/80">
            Anyone who enters the same room joins instantly—no schedule required.{" "}
            {suggestedRoom ? (
              <>
                We pre-filled <code className="rounded bg-white px-1.5 py-0.5">{suggestedRoom}</code>{" "}
                to get you started.
              </>
            ) : (
              "Use something memorable like demo-room-1."
            )}
          </p>
        </div>

        {lessons.length > 0 && (
          <ul className="mt-5 divide-y">
            {lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[#111629]">
                    {formatDateTime(lesson.start)}
                    {lesson.end ? ` — ${formatDateTime(lesson.end)}` : ""}
                  </p>
                  <p className="text-sm text-slate-600">
                    {role === "tutor" ? "Student" : "Tutor"}: {lesson.counterpartName}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {lesson.status === "in_progress" ? "In progress" : "Scheduled"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Room: <code className="rounded bg-slate-100 px-1.5 py-0.5">{lesson.roomName}</code>
                  </p>
                </div>
                <Link
                  href={`/lesson/${lesson.roomName}`}
                  className="inline-flex items-center justify-center rounded px-4 py-2 text-[#111629]"
                  style={{ backgroundColor: "#F7D250" }}
                >
                  {lesson.status === "in_progress" ? "Rejoin now" : "Join room"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ManualJoinFallback suggestedRoom={suggestedRoom} />
      </div>
    </DashboardShell>
  );
}

function ManualJoinFallback({ suggestedRoom }: { suggestedRoom: string | null }) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[#111629]">Need to enter a room ID?</h2>
      <p className="mt-2 text-sm text-slate-600">
        If your tutor shared a room name directly, you can still join manually.
      </p>
      <ManualJoinForm defaultRoom={suggestedRoom} />
    </section>
  );
}
