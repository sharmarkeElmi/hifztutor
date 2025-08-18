"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TutorProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // profiles table
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // tutor_profiles table
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [languagesCSV, setLanguagesCSV] = useState(""); // UI as CSV
  const [rate, setRate] = useState<string>(""); // UI as plain number string
  const [countryCode, setCountryCode] = useState("");
  const [years, setYears] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setError("You must be signed in.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      if (!profile) {
        setError("No profile found.");
        setLoading(false);
        return;
      }

      if (profile.role !== "tutor") {
        setError("This area is for tutors.");
        setLoading(false);
        return;
      }

      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");

      const { data: tprof, error: tErr } = await supabase
        .from("tutor_profiles")
        .select(
          "tutor_id, headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url"
        )
        .eq("tutor_id", user.id)
        .maybeSingle();

      if (tErr) {
        setError(tErr.message);
        setLoading(false);
        return;
      }

      if (tprof) {
        setHeadline(tprof.headline ?? "");
        setBio(tprof.bio ?? "");
        setLanguagesCSV((tprof.languages ?? []).join(", "));
        setRate(
          tprof.hourly_rate_cents != null
            ? String((tprof.hourly_rate_cents / 100).toFixed(0))
            : ""
        );
        setCountryCode(tprof.country_code ?? "");
        setYears(
          tprof.years_experience != null ? String(tprof.years_experience) : ""
        );
        setPhotoUrl(tprof.photo_url ?? "");
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      setError("You must be signed in.");
      setSaving(false);
      return;
    }

    // update profiles
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    if (pErr) {
      setError(pErr.message);
      setSaving(false);
      return;
    }

    // upsert tutor_profiles
    const hourly_rate_cents =
      rate.trim() === "" ? null : Math.max(0, Math.round(Number(rate) * 100));

    const languagesArr = languagesCSV
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const yearsNum = years.trim() === "" ? null : Math.max(0, Math.round(Number(years)));

    const { error: tErr } = await supabase.from("tutor_profiles").upsert(
      {
        tutor_id: user.id,
        headline: headline || null,
        bio: bio || null,
        languages: languagesArr.length ? languagesArr : null,
        hourly_rate_cents,
        country_code: countryCode || null,
        years_experience: yearsNum,
        photo_url: photoUrl || null,
      },
      { onConflict: "tutor_id" }
    );

    if (tErr) {
      setError(tErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    // Navigate back to where they came from (or keep them on the page)
    router.back();
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-sm text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Edit tutor profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your public information. These details will appear on your tutor profile and in search results.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* General (profiles) */}
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">General</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Ustadh Ahmed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Avatar URL (optional)</label>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://…"
                />
              </div>
            </div>
          </section>

          {/* Tutor-specific */}
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">Tutor details</h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="block text-sm font-medium">Headline</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Qur’an teacher • 3+ years experience"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Short bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Tell students about your approach and experience…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium">Languages (CSV)</label>
                  <input
                    value={languagesCSV}
                    onChange={(e) => setLanguagesCSV(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Arabic (native), English (fluent)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Hourly rate</label>
                  <div className="relative">
                    <input
                      value={rate}
                      onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="mt-1 w-full rounded-md border px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="20"
                      inputMode="numeric"
                    />
                    <span className="absolute right-2 top-[10px] text-sm text-muted-foreground">/hr</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium">Country (ISO2)</label>
                  <input
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-md border px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="GB"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Years experience</label>
                  <input
                    value={years}
                    onChange={(e) => setYears(e.target.value.replace(/[^0-9]/g, ""))}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="3"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Photo URL (optional)</label>
                  <input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://…"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}