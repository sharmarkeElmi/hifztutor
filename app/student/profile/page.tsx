"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  full_name: z.string().min(2, { message: "Please enter your full name" }),
});

type Values = z.infer<typeof schema>;

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "" },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        router.replace("/signin");
        return;
      }
      const userId = session.user.id;

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
  }, [router, setValue]);

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

    router.replace("/dashboard");
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  return (
    <section className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Edit profile</h1>
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