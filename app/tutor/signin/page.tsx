"use client";

// Tutor Sign-In page: Allows tutors to log in and, if authorized, redirects them to their dashboard.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Handles the sign-in process, checks user role, and redirects tutors to their dashboard
  const onSubmit = async (values: Values) => {
    // Set loading state and clear any previous errors
    setLoading(true);
    setError(null);

    // Attempt to sign in using Supabase with provided credentials
    const { error: signInError } = await supabase.auth.signInWithPassword(values);
    setLoading(false);

    // Handle sign-in errors
    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Fetch the current user and their profile role
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // Redirect tutors to their dashboard, otherwise show unauthorized error
      if (profile?.role === "tutor") {
        router.push("/tutor/dashboard");
      } else {
        setError("You are not authorized to access the tutor dashboard.");
        return;
      }
    }
  };

  // UI form for tutors to enter credentials, with sign-up and student sign-in links
  return (
    <section className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Tutor — Sign in</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="email">Email</label>
          <input id="email" type="email" {...register("email")} className="w-full p-2 border rounded" placeholder="you@example.com" />
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="password">Password</label>
          <input id="password" type="password" {...register("password")} className="w-full p-2 border rounded" placeholder="••••••••" />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/tutor/signup" className="text-blue-600 hover:underline">Create a tutor account</Link>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Are you a student?{" "}
        <Link href="/signin" className="text-blue-600 hover:underline">Student sign in</Link>
      </div>
    </section>
  );
}