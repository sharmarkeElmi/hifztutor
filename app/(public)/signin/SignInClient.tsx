"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@components/ui/button";
import FormCard from "@/components/forms/FormCard";
import { formStack, formLabel, formInput, formError } from "@/components/forms/classes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client-browser";

const schema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type Values = z.infer<typeof schema>;

type Props = {
  nextPath?: string | null;
  showCheckEmail?: boolean;
  showRoleWarning?: boolean;
};

function sanitizeRedirect(input?: string | null): string | null {
  if (!input) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  return input;
}

export default function SignInClient({ nextPath, showCheckEmail = false, showRoleWarning = false }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (values: Values) => {
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword(values);
      if (signInError) {
        setError(signInError.message || "Invalid email or password.");
        return;
      }

      const { data: userData, error: getUserError } = await supabase.auth.getUser();
      if (getUserError) {
        setError("We could not verify your account. Please try again.");
        return;
      }

      const user = userData?.user;
      if (!user) {
        setError("We could not sign you in. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError("We had trouble loading your account. Please try again.");
        return;
      }

      const role = profile?.role;
      if (role !== "student" && role !== "tutor") {
        setError(
          "We couldn’t determine your account role. Please sign up as a student or tutor before logging in."
        );
        return;
      }

      const dashboard = role === "tutor" ? "/tutor/dashboard" : "/student/dashboard";
      const safeNext = sanitizeRedirect(nextPath ?? null);
      const destination = safeNext ?? dashboard;

      router.replace(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormCard title="Log In">
      
      {showCheckEmail ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          Please confirm your email from the link we sent, then sign in with your password to continue.
        </div>
      ) : null}

      {showRoleWarning ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="alert">
          We couldn’t match your account to a role yet. Try signing in again or reach out to support so we can finish setting things up for you.
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className={formStack} noValidate>
        <div className="space-y-1">
          <label htmlFor="email" className={formLabel}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            {...register("email")}
            className={formInput}
            placeholder="you@example.com"
          />
          {errors.email ? (
            <p className={formError} role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={formLabel}>
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-xs font-semibold text-[#111629] underline"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            {...register("password")}
            className={formInput}
            placeholder="Enter your password"
          />
          {errors.password ? (
            <p className={formError} role="alert">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={loading} variant="formPrimary" className="w-full">
          {loading ? "Signing you in…" : "Log in"}
        </Button>
      </form>

      <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-center">
        <p className="text-sm font-semibold tracking-tight text-[#111629]">New to HifzTutor?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="/student/signup"
            className="inline-flex w-full items-center justify-center rounded-md border border-[#CED2D9] px-4 py-2 text-sm font-semibold text-[#111629] transition hover:border-[#111629] hover:bg-[#F4F6FB]"
          >
            Sign up as Student
          </a>
          <a
            href="/tutor/signup"
            className="inline-flex w-full items-center justify-center rounded-md border border-[#CED2D9] px-4 py-2 text-sm font-semibold text-[#111629] transition hover:border-[#111629] hover:bg-[#F4F6FB]"
          >
            Sign up as Tutor
          </a>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Choose the path that matches how you plan to use HifzTutor and get started in minutes.
        </p>
      </div>
    </FormCard>
  );
}
