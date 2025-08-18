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

import { useState } from "react";
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
import { supabase } from "@/lib/supabase";
import Header from "@/app/components/Header";

// Schema describing valid form values
const schema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});
type Values = z.infer<typeof schema>;

export default function StudentSignInPage() {
  const router = useRouter();

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

    const { error: signInError } = await supabase.auth.signInWithPassword(values);

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Full reload preferred to avoid session race with the dashboard's auth guard
    if (typeof window !== "undefined") {
      window.location.assign("/student/dashboard");
    } else {
      router.push("/student/dashboard");
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
        <h1 className="text-3xl font-bold text-center font-sans">Student — Sign in</h1>

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
                className="absolute inset-y-0 right-3 my-auto h-8 px-4 text-xs rounded bg-[#1d7f63] text-white hover:bg-[#16624d] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition"
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFD600] text-black py-3 rounded-lg font-medium font-sans transition duration-200 hover:bg-[#e6c200] active:bg-[#cca700] focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
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