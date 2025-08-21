"use client";

/**
 * Student — Sign up page
 * -----------------------------------------
 * Purpose:
 *  - Register a new student with email/password.
 *  - Store role in Supabase Auth metadata (role: "student").
 *  - If we get a session immediately (confirmation off), create profile row + go to dashboard.
 *  - Otherwise, send the user to /student/signin with a "check your email" hint.
 *
 * Notes:
 *  - We only upsert the profile when we actually have a session (i.e., a user id).
 *  - Tutor flow (role: "tutor") lives separately under /tutor/signup.
 */

import Header from "@/app/components/Header";
import { useState } from "react";
import { useForm } from "react-hook-form";

// =====================
// FORM VALIDATION
// =====================
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// =====================
// NEXT.JS + SUPABASE
// =====================
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Describe valid form values for signup
const schema = z.object({
  full_name: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});
type Values = z.infer<typeof schema>;

export default function StudentSignUpPage() {
  const router = useRouter();

  const supabase = createClientComponentClient();

  // =====================
  // LOCAL UI STATE
  // =====================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Hook up react-hook-form with Zod schema
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  // =====================
  // SUBMIT HANDLER
  // =====================
  const onSubmit = async (values: Values) => {
    setLoading(true);
    setError(null);

    // Create the user in Supabase Auth.
    // We include metadata: role: "student" + full_name for convenience.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.full_name, role: "student" },
        // After email confirmation, user lands on the student sign-in page
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/student/signin?checkEmail=1`
            : undefined,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If confirmation is OFF, Supabase may return an active session + user now.
    if (signUpData.session && signUpData.user) {
      // We have a user id, so create/update the profile row.
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        full_name: values.full_name,
        role: "student",
      });

      setLoading(false);

      // Prefer full reload so subsequent pages see the fresh session immediately
      if (typeof window !== "undefined") {
        window.location.assign("/student/dashboard");
      } else {
        router.push("/student/dashboard");
      }
      return;
    }

    // Most setups require email confirmation → send user to sign-in with hint
    setLoading(false);
    router.push("/student/signin?checkEmail=1");
  };

  // =====================
  // VIEW
  // =====================
  return (
    <>
      <Header />
      <section className="max-w-md mx-auto mt-12 space-y-8 bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-3xl font-bold text-center">Student — Sign up</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium mb-1 font-sans" htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              type="text"
              required
              autoFocus
              {...register("full_name")}
              className="w-full p-3 border rounded focus:ring-2 focus:ring-brand-yellow focus:outline-none placeholder-gray-400 font-sans"
              placeholder="e.g. Ahmed Ali"
            />
            {errors.full_name && <p className="text-red-500 text-sm mt-1 font-sans">{errors.full_name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 font-sans" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              {...register("email")}
              className="w-full p-3 border rounded focus:ring-2 focus:ring-brand-yellow focus:outline-none placeholder-gray-400 font-sans"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1 font-sans">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1 font-sans" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                {...register("password")}
                className="w-full p-3 pr-20 border rounded focus:ring-2 focus:ring-brand-yellow focus:outline-none placeholder-gray-400 font-sans"
                placeholder="••••••••"
                aria-describedby="password-help"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-3 my-auto h-8 px-4 text-xs rounded bg-[#1d7f63] text-white hover:bg-[#16624d] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition font-sans"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p id="password-help" className="mt-1 text-xs text-gray-500 font-sans">At least 6 characters.</p>
            {errors.password && <p className="text-red-500 text-sm mt-1 font-sans">{errors.password.message}</p>}
          </div>

          {/* Global error */}
          {error && (
            <p className="text-red-600 text-sm font-sans" role="alert" aria-live="assertive">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFD600] text-black py-3 rounded-lg font-medium transition duration-200 hover:bg-[#e6c200] active:bg-[#cca700] focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600] disabled:opacity-50 disabled:cursor-not-allowed font-sans"
          >
            {loading ? "Signing up..." : "Sign up"}
          </button>
        </form>

        {/* Auth cross-links */}
        <div className="text-center text-sm">
          Already have an account?{" "}
          <Link href="/student/signin" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Are you a tutor?{" "}
          <Link href="/tutor/signup" className="text-blue-600 hover:underline">
            Create a tutor account
          </Link>
        </div>
      </section>
    </>
  );
}