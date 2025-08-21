"use client";

import Header from "@/app/components/Header"; // Public navigation bar
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// -----------------------------
// Validation schema (Zod)
// -----------------------------
const schema = z.object({
  full_name: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Infer the form values type from the schema
type Values = z.infer<typeof schema>;

export default function TutorSignUpPage() {
  const router = useRouter();

  // Cookie-aware Supabase client for client components
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // toggle visibility

  // react-hook-form setup with Zod
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  // Submit handler
  const onSubmit = async (values: Values) => {
    setLoading(true);
    setError(null);

    // Create auth user with role metadata and redirect after email confirm
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.full_name, role: "tutor" },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/tutor/signin?checkEmail=1`
            : undefined,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If confirmation is OFF, Supabase may return an active session + user now
    if (signUpData.session && signUpData.user) {
      // Ensure profile row exists with correct role
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        full_name: values.full_name,
        role: "tutor",
      });

      setLoading(false);
      // Full reload helps downstream client pages see fresh auth cookie
      if (typeof window !== "undefined") {
        window.location.assign("/tutor/dashboard");
      } else {
        router.push("/tutor/dashboard");
      }
      return;
    }

    // Most setups require email confirmation → send user to sign-in with hint
    setLoading(false);
    router.push("/tutor/signin?checkEmail=1");
  };

  return (
    <>
      <Header />

      <section className="max-w-md mx-auto mt-12 space-y-8 bg-white p-8 rounded-lg shadow-md border border-gray-200">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center font-sans">Tutor — Sign up</h1>

        {/* Form */}
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
              className="w-full p-3 border rounded font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none placeholder-gray-400"
              placeholder="e.g. Ustadh Ali"
            />
            {errors.full_name && (
              <p className="text-red-600 text-sm mt-1 font-sans" role="alert" aria-live="assertive">{errors.full_name.message}</p>
            )}
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
                autoComplete="new-password"
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
            {errors.password && (
              <p className="text-red-600 text-sm mt-1 font-sans" role="alert" aria-live="assertive">{errors.password.message}</p>
            )}
          </div>

          {/* Global error */}
          {error && (
            <p className="text-red-600 text-sm font-sans" role="alert" aria-live="assertive">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFD600] text-black py-3 rounded-lg font-medium font-sans transition duration-200 hover:bg-[#e6c200] active:bg-[#cca700] focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD600] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing up..." : "Sign up"}
          </button>
        </form>

        {/* Cross-links */}
        <div className="text-center text-sm font-sans">
          Already have a tutor account?{" "}
          <Link href="/tutor/signin" className="text-blue-600 hover:underline">Sign in</Link>
        </div>

        <div className="text-center text-xs text-muted-foreground font-sans">
          Are you a student? {" "}
          <Link href="/student/signup" className="text-blue-600 hover:underline">Student sign up</Link>
        </div>
      </section>
    </>
  );
}