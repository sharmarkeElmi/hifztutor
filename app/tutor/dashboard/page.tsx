"use client";

/**
 * Tutor — Dashboard
 * -----------------------------------------
 * Purpose:
 *  - Auth-gated page for tutors.
 *  - Ensures only users with role="tutor" can access.
 *  - Self-heals the profile row if missing but auth metadata says they're a tutor.
 *
 * Notes:
 *  - If no session → redirect to /tutor/signin.
 *  - If profile says not tutor AND auth metadata also not tutor → send them to student dashboard.
 *  - If profile missing but auth metadata says tutor → create/upgrade the profile, then continue.
 *  - Link to profile uses /student/profile for now (shared profile editor).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function TutorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // visible error if self-heal fails

  useEffect(() => {
    let active = true;

    (async () => {
      // =============== 1) AUTH GUARD ===============
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;

      const session = sessionData?.session;
      if (!session) {
        // Not signed in → go to tutor sign-in
        window.location.replace("/tutor/signin");
        return;
      }

      const user = session.user;
      setEmail(user.email ?? null);

      // What auth metadata says (set at tutor signup)
      const authRole = user.user_metadata?.role as string | undefined;
      const authFullName = (user.user_metadata?.full_name as string | undefined) ?? null;

      // =============== 2) LOAD/VERIFY PROFILE ===============
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        // If we can't read the profile due to RLS, show a message (helps debugging)
        setErrorMsg(profileError.message);
        setLoading(false);
        return;
      }

      // Case A: No profile row, but auth metadata says tutor → self-heal by creating it
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

      // Case B: Profile exists but role is not tutor
      if (profile && profile.role !== "tutor") {
        // If auth metadata says tutor, upgrade role
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

      // Case C: Profile exists and role is tutor → proceed
      setFullName(profile?.full_name ?? authFullName);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/tutor/signin");
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <section className="max-w-4xl mx-auto space-y-6">
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
          <p className="mt-2 text-sm text-red-600">
            Profile error: {errorMsg}
          </p>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Upcoming lessons to teach</h2>
        <p className="text-sm text-muted-foreground">
          You have no lessons scheduled. Accept a booking to get started.
        </p>
      </div>

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