"use client";

/**
 * Student — Dashboard
 * -----------------------------------------
 * Purpose:
 *  - Auth-gated page that shows a student's upcoming lessons and quick actions.
 *  - Loads the student's profile to greet them by name (fallback to email).
 *  - Provides a "Join lesson" placeholder (will open LiveKit later).
 *  - Provides a "Sign out" button.
 *
 * Key ideas:
 *  - We check auth on mount via supabase.auth.getSession().
 *  - If not signed in → redirect to /student/signin.
 *  - For now, lessons are hard-coded placeholders (replace with DB later).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Type describing a single lesson row (placeholder for now)
type Lesson = {
  id: string;
  startsAt: string; // ISO timestamp
  endsAt: string;   // ISO timestamp
  withName: string; // tutor or student name
  roleOpposite: "Tutor" | "Student";
};

export default function StudentDashboardPage() {
  // =============== LOCAL STATE ===============
  const [loading, setLoading] = useState(true);           // true until auth/profile checks complete
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  // =============== AUTH GUARD + PROFILE LOAD ===============
  useEffect(() => {
    let active = true;

    (async () => {
      // 1) Check if there's an active session
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const session = data?.session;
      if (!session) {
        // Not signed in → go to /student/signin
        window.location.replace("/student/signin");
        return;
      }

      // 2) We have a session → capture email
      const user = session.user;
      setEmail(user.email ?? null);

      // 3) Load profile to get full_name (optional; nice greeting)
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      // If query fails, we just fall back to email
      setFullName(error ? null : (profile?.full_name ?? null));

      // Done bootstrapping
      setLoading(false);
    })();

    // Cleanup in case the component unmounts mid-request
    return () => { active = false; };
  }, []);

  // =============== PLACEHOLDER LESSONS (replace with DB soon) ===============
  const lessons: Lesson[] = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const base: Lesson[] = [
      {
        id: "lsn_001",
        startsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // +2h
        endsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),   // +3h
        withName: "Ustadh Ali",
        roleOpposite: "Tutor",
      },
      {
        id: "lsn_002",
        startsAt: new Date(now.getTime() + dayMs + 4 * 60 * 60 * 1000).toISOString(), // +1d 4h
        endsAt: new Date(now.getTime() + dayMs + 5 * 60 * 60 * 1000).toISOString(),
        withName: "Fatimah",
        roleOpposite: "Student",
      },
      {
        id: "lsn_003",
        startsAt: new Date(now.getTime() + 2 * dayMs).toISOString(),                 // +2d
        endsAt: new Date(now.getTime() + 2 * dayMs + 60 * 60 * 1000).toISOString(),  // +1h
        withName: "Yusuf",
        roleOpposite: "Student",
      },
    ];

    return base.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, []);

  const nextLesson = lessons[0] ?? null;

  // Format helper for timestamps
  const formatDT = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Join action (MVP): navigate to a room named after the lesson id.
  // Later, this will use a real `roomName` stored in the DB with each booking.
  const handleJoin = (lesson: Lesson) => {
    window.location.assign(`/lesson/${lesson.id}`);
  };

  // Sign out and return to the student sign-in page
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error.message);
      return;
    }
    // Full reload ensures all guards see the cleared session
    window.location.assign("/student/signin");
  };

  // =============== LOADING STATE ===============
  if (loading) return <p className="text-center mt-10">Loading...</p>;

  // =============== VIEW ===============
  return (
    <section className="max-w-4xl mx-auto space-y-6">
      {/* Top bar / Greeting */}
      <div>
        <h1 className="text-2xl font-semibold">Student Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {fullName ? fullName : email}
        </p>
        <p className="text-sm mt-1">
          <Link href="/student/profile" className="text-blue-600 hover:underline">
            Edit profile
          </Link>
        </p>
      </div>

      {/* Quick actions: visible to signed-in students */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Primary path for MVP joining: manual room entry page */}
        <Link
          href="/lesson/join"
          className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Join a live lesson
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
            <button
              onClick={() => handleJoin(nextLesson)}
              className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Join lesson
            </button>
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
              <li
                key={l.id}
                className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatDT(l.startsAt)} — {formatDT(l.endsAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    With {l.withName} ({l.roleOpposite})
                  </p>
                </div>
                <button
                  onClick={() => handleJoin(l)}
                  className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No lessons scheduled this week.</p>
        )}
      </div>

      {/* Sign out */}
      <div className="flex justify-end">
        <button
          onClick={handleSignOut}
          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}