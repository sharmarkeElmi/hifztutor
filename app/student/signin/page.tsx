"use client";

/**
 * Student — Sign in page
 * -----------------------------------------
 * Purpose:
 *  - Render a simple email/password sign-in form.
 *  - On success, redirect to /student/dashboard (full page load to avoid session race conditions).
 *
 * Key ideas:
 *  - We keep this page student-only (no role checks here).
 *  - Tutor flow lives separately at /tutor/signin.
 */

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

// =====================
// FORM VALIDATION
// - Zod schema + react-hook-form for simple client-side validation
// =====================
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// =====================
// NEXT.JS + SUPABASE
// - Link: client-side route transitions
// - supabase: our initialized browser client
// (router is a fallback if window is unavailable; we prefer full reloads)
// =====================
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@components/ui/button";
import { createBrowserClient } from "@supabase/ssr";
import Header from "@/app/components/Header";

// Schema describing valid form values
const schema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});
type Values = z.infer<typeof schema>;

export default function StudentSignInPage() {
  const router = useRouter();

  // Create a Supabase client for client-side usage
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // =====================
  // LOCAL UI STATE
  // - loading: disables form while request is in-flight
  // - error: shows any sign-in error message
  // =====================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Hook up react-hook-form with our schema
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // =====================
  // SUBMIT HANDLER
  // - Calls Supabase password sign-in
  // - On success, perform a *full page load* to /student/dashboard
  //   (ensures auth cookies are present before the dashboard guard runs)
  // =====================
const onSubmit = async (values: Values) => {
  setLoading(true);
  setError(null);

  try {
    // 1) Attempt sign-in
    const { data, error: signInError } = await supabase.auth.signInWithPassword(values);
    console.log("[signin] document.cookie =>", typeof document !== "undefined" ? document.cookie : "(no document)");
    console.log("[signin] signInWithPassword ->", { user: data?.user, signInError });

    if (signInError) {
      setLoading(false);
      setError(signInError.message || "Sign in failed.");
      return;
    }

    // 2) Verify the session exists (cookie-based)
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    console.log("[signin] getSession ->", { session: sessionData?.session, sessionErr });

    if (sessionErr || !sessionData?.session) {
      setLoading(false);
      setError("Signed in, but no session was found. Please try again.");
      return;
    }

    // 3) Hard redirect to student dashboard (avoids any race with guards)
    if (typeof window !== "undefined") {
      window.location.href = "/student/dashboard";
    } else {
      router.push("/student/dashboard");
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[signin] unexpected error:", e);
    setError(msg);
  } finally {
    setLoading(false);
  }
};

  // =====================
  // VIEW
  // =====================
  return (
    <>
      <Header />
      <section className="max-w-md mx-auto mt-12 space-y-8 bg-white p-8 rounded-lg shadow-md border border-gray-200">
        {/* Page title */}
        <h1 className="text-3xl font-bold text-center font-sans">Student — Log In</h1>

        {/* Sign-in form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email field */}
          <div>
            <label className="block text-sm font-medium mb-1 font-sans" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              {...register("email")}
              className="w-full p-3 border rounded font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none placeholder-gray-400"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-600 text-sm mt-1 font-sans" role="alert" aria-live="assertive">{errors.email.message}</p>}
          </div>

          {/* Password field */}
          <div>
            <label className="block text-sm font-medium mb-1 font-sans" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                {...register("password")}
                className="w-full p-3 pr-20 border rounded font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none placeholder-gray-400"
                placeholder="••••••••"
                aria-describedby="password-help"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-3 my-auto h-8 px-4 text-xs rounded bg-[#D3F501] text-black border-2 border-black hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p id="password-help" className="mt-1 text-xs text-gray-500 font-sans">At least 6 characters.</p>
            {errors.password && <p className="text-red-600 text-sm mt-1 font-sans" role="alert" aria-live="assertive">{errors.password.message}</p>}
          </div>

          {/* Error helper */}
          {error && (
            <p className="text-red-600 text-sm font-sans" role="alert" aria-live="assertive">{error}</p>
          )}

          {/* Submit */}
          <Button type="submit" variant="default" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {/* Auth cross-links */}
        <div className="text-center text-sm font-sans">
          Don&apos;t have an account?{" "}
          <Link href="/student/signup" className="text-blue-600 hover:underline">
            Create a student account
          </Link>
        </div>

        <div className="text-center text-xs text-muted-foreground font-sans">
          Are you a tutor?{" "}
          <Link href="/tutor/signin" className="text-blue-600 hover:underline">
            Tutor sign in
          </Link>
        </div>
      </section>
    </>
  );
}
