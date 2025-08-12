"use client";

/**
 * Tutor — Dashboard
 * -----------------------------------------
 * Purpose:
 *  - Auth‑gated page for tutors only.
 *  - Verifies the signed‑in user has role="tutor" (via profile and/or auth metadata).
 *  - Self‑heals the profile row if missing but the user's auth metadata says they're a tutor.
 *
 * Notes:
 *  - If no session → redirect to /tutor/signin.
 *  - If profile exists with role ≠ "tutor" but auth metadata says "tutor" → upgrade profile role.
 *  - If profile missing but auth metadata says "tutor" → create it (upsert).
 *  - Shared profile editor currently lives at /student/profile (we'll split later if needed).
 *  - MVP quick action added: "Join a live lesson" → /lesson/join
 *    (Later this will be replaced by per‑booking Join buttons.)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function TutorDashboardPage() {
  // =============== Local UI state ===============
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // shown if profile self‑heal fails

  // =============== Auth guard + profile load/self‑heal ===============
  useEffect(() => {
    let active = true;

    (async () => {
      // 1) Check session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      const session = sessionData?.session;
      if (!session) {
        // Not signed in → go to tutor sign‑in
        window.location.replace("/tutor/signin");
        return;
      }

      const user = session.user;
      setEmail(user.email ?? null);

      // What the auth metadata says (set during /tutor/signup)
      const authRole = user.user_metadata?.role as string | undefined;
      const authFullName =
        (user.user_metadata?.full_name as string | undefined) ?? null;

      // 2) Load the profile to confirm role and name
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        // Likely an RLS issue or table issue; show for debugging
        setErrorMsg(profileError.message);
        setLoading(false);
        return;
      }

      // A) No profile row, but auth metadata says tutor → create it
      if (!profile && authRole === "tutor") {
        const { error: upsertErr } = await supabase.from("profiles").upsert({
          id: user.id,
          full_name: authFullName,
          role: "tutor",
        });
        if (upsertErr) {
          setErrorMsg(upsertErr.message);
          setLoading(false);
          return;
        }
        setFullName(authFullName);
        setLoading(false);
        return;
      }

      // B) Profile exists but role is not tutor
      if (profile && profile.role !== "tutor") {
        // If auth metadata says tutor, upgrade it
        if (authRole === "tutor") {
          const { error: updateErr } = await supabase
            .from("profiles")
            .update({ role: "tutor" })
            .eq("id", user.id);
          if (updateErr) {
            setErrorMsg(updateErr.message);
            setLoading(false);
            return;
          }
          setFullName(profile.full_name ?? authFullName);
          setLoading(false);
          return;
        }

        // Auth metadata also not tutor → send to student dashboard
        window.location.replace("/student/dashboard");
        return;
      }

      // C) Profile exists and role is tutor → good to go
      setFullName(profile?.full_name ?? authFullName);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  // =============== Sign out ===============
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/tutor/signin");
  };

  // =============== Loading state ===============
  if (loading) return <p className="text-center mt-10">Loading...</p>;

  // =============== View ===============
  return (
    <section className="max-w-4xl mx-auto space-y-6">
      {/* Header / greeting */}
      <div>
        <h1 className="text-2xl font-semibold">Tutor Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {fullName || email}
        </p>
        <p className="text-sm mt-1">
          {/* Using the shared student profile editor for now */}
          <Link href="/student/profile" className="text-blue-600 hover:underline">
            Edit profile
          </Link>
        </p>
        {errorMsg && (
          <p className="mt-2 text-sm text-red-600">Profile error: {errorMsg}</p>
        )}
      </div>

      {/* Quick actions: visible to signed-in tutors */}
      <div className="flex flex-wrap items-center gap-3">
        {/* MVP path to LiveKit: manual room entry page */}
        <Link
          href="/lesson/join"
          className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Join a live lesson
        </Link>
      </div>

      {/* Placeholder: upcoming lessons the tutor will teach (will be DB-driven later) */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Upcoming lessons to teach</h2>
        <p className="text-sm text-muted-foreground">
          You have no lessons scheduled. Accept a booking to get started.
        </p>
        {/* Future:
            - Render a list of lessons pulled from DB.
            - Each row includes a contextual "Join" button:
              <button onClick={() => window.location.assign(`/lesson/${lesson.roomName}`)}>Join</button>
         */}
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