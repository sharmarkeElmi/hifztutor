// Student Profile Edit page for viewing/updating profile details
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useMemo } from "react";

// Defines form validation rules using Zod
const schema = z.object({
  full_name: z.string().min(2, { message: "Please enter your full name" }),
});

type Values = z.infer<typeof schema>;

// Main profile page component for students
export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "" },
  });

  useEffect(() => {
    /**
     * Checks for authentication, redirects if not logged in,
     * and fetches the current profile data to pre-fill the form.
     */
    let active = true;
    (async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Failed to verify auth in student profile:", userError.message);
      }
      const user = userData?.user;
      if (!user) {
        router.replace("/signin");
        return;
      }
      const userId = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      if (active) {
        if (profile?.full_name) setValue("full_name", profile.full_name);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router, setValue, supabase]);

  /**
   * Handles saving changes to the profile
   * and redirects the user to the dashboard.
   */
  const onSubmit = async (values: Values) => {
    setSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      router.replace("/signin");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: values.full_name,
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/student/dashboard");
  };

  // Shows a loading message while profile data is being fetched
  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <section className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Edit profile</h1>
      {/* Editable profile form with a single "full name" field,
          also shows validation errors and save status */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </section>
  );
}
