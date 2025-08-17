"use client";

/**
 * Tutor — Dashboard (Shell version)
 * -----------------------------------------
 * - Uses the shared <Shell role="tutor" activeKey="overview"> to match the
 *   student dashboard layout and sidebar.
 * - Preserves the original auth/role checks and profile self‑healing.
 * - Non‑blocking UI: shows a lightweight loader while checking.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Shell from "../../components/dashboard/Shell"; // shared dashboard chrome

export default function TutorDashboardPage() {
  // =============== Local UI state ===============
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // =============== Auth guard + profile load/self‑heal ===============
  useEffect(() => {
    let active = true;

    (async () => {
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

      const authRole = user.user_metadata?.role as string | undefined;
      const authFullName =
        (user.user_metadata?.full_name as string | undefined) ?? null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setErrorMsg(profileError.message);
        setLoading(false);
        return;
      }

      // No profile row, but auth metadata says tutor → create it
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

      // Profile exists but role is not tutor
      if (profile && profile.role !== "tutor") {
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
        // Auth metadata also not tutor → route to student dashboard
        window.location.replace("/student/dashboard");
        return;
      }

      // Final guard — only tutors may view this page
      if (!profile || profile.role !== "tutor") {
        window.location.replace("/student/dashboard");
        return;
      }

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

  // =============== View ===============
  return (
    <Shell role="tutor" activeKey="overview">
      {/* Header / greeting */}
      <div className="mb-4">
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
        {/* Later: render lessons from DB with contextual Join buttons */}
      </div>

      {/* Sign out */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSignOut}
          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
        >
          Sign out
        </button>
      </div>

      {/* Lightweight loader overlay when checking session */}
      {loading && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm grid place-items-center">
          <div className="rounded-md bg-white px-4 py-3 text-sm shadow">Checking your tutor access…</div>
        </div>
      )}
    </Shell>
  );
}