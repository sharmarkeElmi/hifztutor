"use client";

// Tutor Sign-In page: Allows tutors to log in and, if authorized, redirects them to their dashboard.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useMemo } from "react";
import Header from "@/app/components/Header"; // Public navigation bar

// Zod schema for validating email and password inputs
const schema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type Values = z.infer<typeof schema>;

// TutorSignInPage handles tutor sign-in, verifies their role, and redirects accordingly.
export default function TutorSignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // toggle visibility
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Handles the sign-in process, checks user role, and redirects tutors to their dashboard
  const onSubmit = async (values: Values) => {
    setLoading(true);
    setError(null);

    try {
      // 1) Attempt sign-in (this will set cookie-based session via auth-helpers client)
      const { data, error: signInError } = await supabase.auth.signInWithPassword(values);
      console.log("[tutor signin] signInWithPassword ->", { user: data?.user, signInError });

      if (signInError) {
        setLoading(false);
        setError(signInError.message || "Sign in failed.");
        return;
      }

      // 2) Verify session exists
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      console.log("[tutor signin] getSession ->", { session: sessionData?.session, sessionErr });
      if (sessionErr || !sessionData?.session) {
        setLoading(false);
        setError("Signed in, but no session was found. Please try again.");
        return;
      }

      // 3) Load profile and verify tutor role
      const user = sessionData.session.user;
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profErr) {
        console.error("[tutor signin] load profile error:", profErr);
        setLoading(false);
        setError("Could not load your profile. Please try again.");
        return;
      }

      if (profile?.role !== "tutor") {
        setLoading(false);
        setError("You are not authorized to access the tutor dashboard.");
        return;
      }

      // 4) Hard redirect to avoid any guard race
      if (typeof window !== "undefined") {
        window.location.href = "/tutor/dashboard";
      } else {
        router.push("/tutor/dashboard");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[tutor signin] unexpected error:", e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // UI form for tutors to enter credentials, with sign-up and student sign-in links
  return (
    <>
      <Header />

      <section className="max-w-md mx-auto mt-12 space-y-8 bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-3xl font-bold text-center font-sans">Tutor — Log In</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
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
            {errors.email && (
              <p className="text-red-600 text-sm mt-1 font-sans" role="alert" aria-live="assertive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
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
            {errors.password && (
              <p className="text-red-600 text-sm mt-1 font-sans" role="alert" aria-live="assertive">{errors.password.message}</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm font-sans" role="alert" aria-live="assertive">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D3F501] text-black py-3 rounded-lg font-medium font-sans transition duration-200 border-2 border-black hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Links */}
        <div className="text-center text-sm font-sans">
          Don&apos;t have an account?{" "}
          <Link href="/tutor/signup" className="text-blue-600 hover:underline">Create a tutor account</Link>
        </div>

        <div className="text-center text-xs text-muted-foreground font-sans">
          Are you a student?{" "}
          <Link href="/student/signin" className="text-blue-600 hover:underline">Student sign in</Link>
        </div>
      </section>
    </>
  );
}
