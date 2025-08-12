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
    <section className="max-w-md mx-auto space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-semibold">Student — Sign in</h1>

      {/* Sign-in form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email field */}
        <div>
          <label className="block text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="w-full p-2 border rounded"
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
        </div>

        {/* Password field */}
        <div>
          <label className="block text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
            className="w-full p-2 border rounded"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>

        {/* Error helper */}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Auth cross-links */}
      <div className="text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/student/signup" className="text-blue-600 hover:underline">
          Create a student account
        </Link>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Are you a tutor?{" "}
        <Link href="/tutor/signin" className="text-blue-600 hover:underline">
          Tutor sign in
        </Link>
      </div>
    </section>
  );
}