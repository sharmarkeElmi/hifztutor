"use client";

/**
 * Student — Dashboard (clean MVP)
 * - Auth + role guard
 * - Greeting (full name fallback to email)
 * - Quick actions route to Lessons & Inbox
 * - Next lesson + Upcoming lessons placeholders
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import DashboardShell from "../../components/dashboard/Shell";

// Placeholder lesson type
type Lesson = {
  id: string;
  startsAt: string;
  endsAt: string;
  withName: string;
  roleOpposite: "Tutor" | "Student";
};

export default function StudentDashboardPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  // -------- Auth + role guard --------
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const session = data?.session;
      if (!session) {
        window.location.replace("/student/signin");
        return;
      }

      const user = session.user;
      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setFullName(profile?.full_name ?? null);

      // If they’re not a student, bounce to tutor dashboard
      if (profile?.role && profile.role !== "student") {
        window.location.replace("/tutor/dashboard");
        return;
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // -------- Placeholder lessons (replace with DB later) --------
  const lessons: Lesson[] = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const base: Lesson[] = [
      {
        id: "lsn_001",
        startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        withName: "Ustadh Ali",
        roleOpposite: "Tutor",
      },
      {
        id: "lsn_002",
        startsAt: new Date(now.getTime() + dayMs + 4 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now.getTime() + dayMs + 5 * 60 * 60 * 1000).toISOString(),
        withName: "Fatimah",
        roleOpposite: "Student",
      },
      {
        id: "lsn_003",
        startsAt: new Date(now.getTime() + 2 * dayMs).toISOString(),
        endsAt: new Date(now.getTime() + 2 * dayMs + 60 * 60 * 1000).toISOString(),
        withName: "Yusuf",
        roleOpposite: "Student",
      },
    ];
    return base.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, []);

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
  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <DashboardShell role="student">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {fullName ? fullName : email}</p>
        <p className="text-sm mt-1">
          <Link href="/student/profile" className="text-blue-600 hover:underline">
            Edit profile
          </Link>
        </p>
      </div>

      {/* Quick actions (route to tabs) */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/student/lessons"
          className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go to Lessons
        </Link>
        <Link
          href="/inbox"
          className="inline-flex items-center justify-center rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Open Inbox
        </Link>
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
              className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Join lesson
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
                  className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
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
    </DashboardShell>
  );
}