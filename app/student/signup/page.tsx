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
import { supabase } from "@/lib/supabase";

// Describe valid form values for signup
const schema = z.object({
  full_name: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});
type Values = z.infer<typeof schema>;

export default function StudentSignUpPage() {
  const router = useRouter();

  // =====================
  // LOCAL UI STATE
  // =====================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Student — Sign up</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-sm font-medium" htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            type="text"
            {...register("full_name")}
            className="w-full p-2 border rounded"
            placeholder="e.g. Ahmed Ali"
          />
          {errors.full_name && <p className="text-red-500 text-sm">{errors.full_name.message}</p>}
        </div>

        {/* Email */}
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

        {/* Password */}
        <div>
          <label className="block text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            className="w-full p-2 border rounded"
            placeholder="••••••••"
          />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>

        {/* Global error */}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Submit */}
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
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
  );
}