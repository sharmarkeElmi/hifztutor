"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@components/ui/button";
import FormCard from "@/components/forms/FormCard";
import { formStack, formLabel, formInput, formHelp, formError } from "@/components/forms/classes";

const schema = z
  .object({
    full_name: z.string().min(2, { message: "Full name is required" }),
    email: z.string().email({ message: "Please enter a valid email" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirm_password: z.string().min(6, { message: "Please confirm your password" }),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm_password"],
        message: "Passwords must match",
      });
    }
  });

type Values = z.infer<typeof schema>;

export default function TutorSignUpPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "" },
  });

  const passwordValue = useWatch({ control, name: "password" });
  const confirmPasswordValue = useWatch({ control, name: "confirm_password" });
  const passwordsMatch = passwordValue && confirmPasswordValue && passwordValue === confirmPasswordValue;

  const onSubmit = async (values: Values) => {
    setLoading(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.full_name, role: "tutor" },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/signin?checkEmail=1`
            : undefined,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (signUpData.session && signUpData.user) {
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        full_name: values.full_name,
        role: "tutor",
      });

      setLoading(false);

      if (typeof window !== "undefined") {
        window.location.assign("/tutor/dashboard");
      } else {
        router.push("/tutor/dashboard");
      }
      return;
    }

    setLoading(false);
    router.push("/signin?checkEmail=1");
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-white px-4 py-12">
      <FormCard
        title="Become a tutor on HifzTutor"
        description="Create your tutor account to connect with students around the world."
        className="w-full max-w-[460px] space-y-8"
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className={formStack} noValidate>
          <div className="space-y-1">
            <label htmlFor="full_name" className={formLabel}>
              Full name
            </label>
            <input
              id="full_name"
              type="text"
              required
              autoFocus
              {...register("full_name")}
              className={formInput}
              placeholder="e.g. Ustadh Ali"
            />
            {errors.full_name ? (
              <p className={formError} role="alert">
                {errors.full_name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className={formLabel}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
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
              required
              autoComplete="new-password"
              {...register("password")}
              className={formInput}
              placeholder="Create a password"
            />
            <p className={formHelp}>At least 6 characters.</p>
            {errors.password ? (
              <p className={formError} role="alert">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm_password" className={formLabel}>
              Confirm password
            </label>
            <input
              id="confirm_password"
              type="password"
              required
              autoComplete="new-password"
              {...register("confirm_password")}
              className={formInput}
              placeholder="Re-enter your password"
            />
            {errors.confirm_password ? (
              <p className={formError} role="alert">
                {errors.confirm_password.message}
              </p>
            ) : (
              confirmPasswordValue ? (
                <p className="text-sm" role="status" aria-live="polite">
                  <span className={passwordsMatch ? "text-[#10B981]" : "text-red-600"}>
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </span>
                </p>
              ) : null
            )}
          </div>

          <Button type="submit" disabled={loading} variant="formPrimary" className="w-full">
            {loading ? "Signing up…" : "Sign up"}
          </Button>
        </form>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm font-semibold tracking-tight text-[#111629]">Already teaching with us?</p>
          <Link
            href="/signin"
            className="inline-flex w-full items-center justify-center rounded-lg border border-[#CED2D9] px-4 py-2 text-sm font-semibold text-[#111629] transition hover:border-[#111629] hover:bg-[#F4F6FB]"
          >
            Log in instead
          </Link>
          <p className="text-xs leading-relaxed text-slate-500">
            Looking to learn?{" "}
            <Link href="/student/signup" className="font-semibold text-[#111629] underline">
              Sign up as a student
            </Link>
          </p>
        </div>
      </FormCard>
    </div>
  );
}
