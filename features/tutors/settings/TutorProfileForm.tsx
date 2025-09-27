"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@components/ui/button";

export default function TutorProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // profiles table
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  // Avatar file/crop state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [previousAvatarUrl, setPreviousAvatarUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // tutor_profiles table
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [languagesCSV, setLanguagesCSV] = useState("");
  const [rate, setRate] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [years, setYears] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState<string>("");
  const [showTips, setShowTips] = useState(true);
  const [showHelp, setShowHelp] = useState(true);

  // Countries for searchable select
  type Country = { iso2: string; name: string };
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

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
      setPreviousAvatarUrl(profile.avatar_url ?? null);

      const { data: tprof, error: tErr } = await supabase
        .from("tutor_profiles")
        .select(
          "tutor_id, headline, bio, languages, hourly_rate_cents, country_code, years_experience, photo_url, subjects, specialties, time_zone"
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
        setCountryCode(tprof.country_code ?? null);
        setYears(
          tprof.years_experience != null ? String(tprof.years_experience) : ""
        );
        setPhotoUrl(tprof.photo_url ?? "");
        setSubjects(Array.isArray(tprof.subjects) ? (tprof.subjects as string[]) : []);
        setSpecialties(Array.isArray(tprof.specialties) ? (tprof.specialties as string[]) : []);
        setTimeZone(tprof.time_zone ?? "");
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Clean up previewUrl blob when changed
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // --- Avatar/photo helpers ---
  function randomString(len: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function buildPublicUrl(path: string): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
  }
  function extractAvatarsPathFromUrl(url: string): string | null {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
    if (!url || !url.startsWith(base)) return null;
    return url.slice(base.length);
  }

  // --- Avatar file validation and picker handlers ---
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB
  const ALLOWED = new Set(["image/jpeg", "image/png"]);

  function onPickFile() {
    fileInputRef.current?.click();
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!ALLOWED.has(f.type)) {
      setAvatarError("Please choose a JPG or PNG.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setAvatarError("Max file size is 2 MB.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    setAvatarError(null);
    setSelectedFile(f);
    setRemoveAvatar(false);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }

  // Load countries for select
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("country_codes")
          .select("iso2,name")
          .order("name", { ascending: true });
        if (!error && !cancelled) setCountries((data ?? []) as Country[]);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const trimmedFullName = fullName.trim();
    const trimmedHeadline = headline.trim();
    const trimmedBio = bio.trim();
    const trimmedLanguages = languagesCSV.trim();
    const trimmedRate = rate.trim();
    const trimmedYears = years.trim();
    const trimmedTimeZone = timeZone.trim();

    if (fullName !== trimmedFullName) setFullName(trimmedFullName);
    if (headline !== trimmedHeadline) setHeadline(trimmedHeadline);
    if (bio !== trimmedBio) setBio(trimmedBio);
    if (languagesCSV !== trimmedLanguages) setLanguagesCSV(trimmedLanguages);
    if (rate !== trimmedRate) setRate(trimmedRate);
    if (years !== trimmedYears) setYears(trimmedYears);
    if (timeZone !== trimmedTimeZone) setTimeZone(trimmedTimeZone);

    const languagesArr = trimmedLanguages
      ? trimmedLanguages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const parsedRate = Number(trimmedRate);
    const parsedYears = Number(trimmedYears);

    const errors: string[] = [];
    if (!trimmedFullName) errors.push("Full name is required.");
    if (!trimmedHeadline) errors.push("Headline is required.");
    if (!trimmedBio) errors.push("Short bio is required.");
    if (!languagesArr.length) errors.push("Please list at least one language.");
    if (!trimmedRate || Number.isNaN(parsedRate) || parsedRate <= 0)
      errors.push("Provide a valid hourly rate greater than 0.");
    if (!countryCode) errors.push("Please choose your country.");
    if (!trimmedYears || Number.isNaN(parsedYears) || parsedYears < 0)
      errors.push("Enter how many years of experience you have.");
    if (!trimmedTimeZone) errors.push("Time zone is required.");
    if (!subjects.length) errors.push("Add at least one subject.");
    if (!specialties.length) errors.push("Add at least one specialty.");

    if (errors.length) {
      setError(errors.join(" "));
      setSaving(false);
      return;
    }

    const normalizedRate = Math.max(0, parsedRate);
    const normalizedYears = Math.max(0, parsedYears);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      setError("You must be signed in.");
      setSaving(false);
      return;
    }

    // --- Avatar upload/removal logic ---
    let newAvatarUrl: string | null = avatarUrl || null;
    // If removing
    if (removeAvatar) {
      newAvatarUrl = null;
    }
    // If a new file is selected, upload it
    if (!removeAvatar && selectedFile) {
      try {
        const ext = selectedFile.type === "image/png" ? "png" : "jpg";
        const path = `${user.id}/${Date.now()}-${randomString(8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });
        if (upErr) throw upErr;
        newAvatarUrl = buildPublicUrl(path);
      } catch {
        setError("Upload failed. Try again.");
        setSaving(false);
        return;
      }
    }

    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        full_name: trimmedFullName,
        avatar_url: newAvatarUrl,
      })
      .eq("id", user.id);

    if (pErr) {
      setError(pErr.message);
      setSaving(false);
      return;
    }

    const hourly_rate_cents = Math.round(normalizedRate * 100);

    const yearsNum = Math.round(normalizedYears);

    const { error: tErr } = await supabase.from("tutor_profiles").upsert(
      {
        tutor_id: user.id,
        headline: trimmedHeadline,
        bio: trimmedBio,
        languages: languagesArr,
        hourly_rate_cents,
        country_code: countryCode || null,
        years_experience: yearsNum,
        photo_url: photoUrl || null,
        subjects,
        specialties,
        time_zone: trimmedTimeZone,
      },
      { onConflict: "tutor_id" }
    );

    if (tErr) {
      setError(tErr.message);
      setSaving(false);
      return;
    }

    // Best-effort delete of previous avatar if replaced or removed
    try {
      if ((removeAvatar || (selectedFile && previousAvatarUrl)) && previousAvatarUrl) {
        const prevPath = extractAvatarsPathFromUrl(previousAvatarUrl);
        if (prevPath) {
          await supabase.storage.from("avatars").remove([prevPath]);
        }
      }
    } catch {
      // ignore cleanup errors
    }

    setPreviousAvatarUrl(newAvatarUrl ?? previousAvatarUrl);
    if (removeAvatar) {
      setAvatarUrl("");
      setPreviewUrl(null);
      setRemoveAvatar(false);
    } else if (!previewUrl && newAvatarUrl) {
      setAvatarUrl(newAvatarUrl);
    }

    setError(null);
    setSaving(false);
    setSuccessMessage("Profile updated successfully.");
  }

  if (loading) {
    return (
      <div className="p-2">
        <div className="animate-pulse text-sm text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-6 pb-28 sm:space-y-4 lg:pb-0">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,340px)]">
        <div className="space-y-6">
          <section className="bg-white p-4 sm:rounded-2xl sm:border sm:border-slate-200 sm:p-6 sm:shadow-sm">
            <div>
              <div className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]">
                <span>Profile image</span>
              </div>
              <p className="mt-2 pl-3 text-sm text-slate-600 leading-snug">
                Upload a bright, front-facing photo so students recognise you before lessons begin.
              </p>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
              <div className="flex flex-col items-center gap-4">
                <div className="h-64 w-64 overflow-hidden rounded-xl border-2 border-black bg-slate-50 shadow-sm">
                  {previewUrl || avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl || avatarUrl}
                      alt={`${fullName || "Tutor"} avatar`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl font-semibold text-slate-400">
                      {(fullName || "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrop(true)}
                  className="rounded px-3 py-1.5 text-sm font-medium text-[#111629] underline underline-offset-4 decoration-[#D3F501] transition-colors disabled:opacity-40 hover:bg-[#F1F2F4]"
                  disabled={!(previewUrl || avatarUrl)}
                  aria-label="Edit photo"
                >
                  Adjust crop
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={onFileChange}
                  />
                  <button
                    type="button"
                    onClick={onPickFile}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#111629] px-4 py-3 text-center text-base font-semibold text-[#111629] hover:bg-slate-50 focus:outline-none sm:w-auto sm:min-w-[320px]"
                    aria-label="Upload photo"
                  >
                    {/* icon from /public */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/upload-photo-icon.svg" alt="" className="h-6 w-6" />
                    Upload new photo
                  </button>
                  <div className="mt-3 text-center text-sm text-slate-400">
                    <div>Maximum size – 2MB</div>
                    <div>JPG or PNG format</div>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-[#111629]">Photo guidelines</p>
                  <ul className="mt-2 space-y-1">
                    <li>• Face the camera with good lighting.</li>
                    <li>• Choose a simple, distraction-free background.</li>
                    <li>• Smile to appear warm and approachable.</li>
                  </ul>
                </div>
                {avatarError ? <div className="text-sm font-medium text-red-600">{avatarError}</div> : null}
              </div>
            </div>
          </section>

          <section className="bg-white p-4 sm:rounded-2xl sm:border sm:border-slate-200 sm:p-6 sm:shadow-sm">
            <div>
              <div className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]">
                <span>Full name</span>
                <span className="text-red-500">*</span>
              </div>
              <p className="mt-2 pl-3 text-sm text-slate-600 leading-snug">Use your real name so students know who they are booking.</p>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                required
                aria-required="true"
                placeholder="e.g. Ustadh Ahmed"
              />
            </div>
          </section>

          <section className="bg-white p-4 sm:rounded-2xl sm:border sm:border-slate-200 sm:p-6 sm:shadow-sm">
            <div>
              <h2 className="mt-1 text-xl font-semibold text-[#111629]">Showcase your expertise</h2>
              <p className="mt-2 text-sm text-slate-500">Give prospective students a clear idea of your experience and how you teach.</p>
            </div>

            <div className="mt-6 space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="tutor-headline"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Headline</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Summarise your teaching style or speciality in one sentence.</p>
                    <textarea
                      id="tutor-headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      rows={2}
                      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                      required
                      aria-required="true"
                      placeholder="Qur’an teacher • 3+ years experience"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="short-bio"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>About Me</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Highlight your methodology, experience and what students can expect.</p>
                    <textarea
                      id="short-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={5}
                      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                      required
                      aria-required="true"
                      placeholder="Tell students about your approach and experience…"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Availability & location</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="languages-csv"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Languages (CSV)</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">List the languages you speak.</p>
                    <input
                      id="languages-csv"
                      value={languagesCSV}
                      onChange={(e) => setLanguagesCSV(e.target.value)}
                      className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                      required
                      aria-required="true"
                      placeholder="Arabic (native), English (fluent)"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hourly-rate"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Hourly rate</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Set the amount students pay per lesson.</p>
                    <div className="relative mt-2">
                      <input
                        id="hourly-rate"
                        value={rate}
                        onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="h-11 w-full rounded-md border border-slate-200 px-3 pr-10 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                        required
                        aria-required="true"
                        min="0"
                        placeholder="20"
                        inputMode="numeric"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">/hr</span>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="country-select"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Country</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Helps us promote you to students nearby.</p>
                    <div className="mt-2">
                      <CountrySelect
                        options={countries}
                        value={countryCode}
                        onChange={setCountryCode}
                        inputId="country-select"
                        placeholder="Select country"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="years-experience"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Years experience</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Share how long you have been teaching.</p>
                    <input
                      id="years-experience"
                      value={years}
                      onChange={(e) => setYears(e.target.value.replace(/[^0-9]/g, ""))}
                      className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                      required
                      aria-required="true"
                      min="0"
                      placeholder="3"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="intro-media"
                    className="flex w-full items-center rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                  >
                    Intro video / photo URL
                  </label>
                  <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Optional link to a hosted welcome video or image gallery.</p>
                  <input
                    id="intro-media"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                    placeholder="https://…"
                  />
                </div>

                <div>
                  <label
                    htmlFor="time-zone"
                    className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                  >
                    <span>Time zone (IANA)</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Your availability will be converted for students automatically.</p>
                  <input
                    id="time-zone"
                    list="common-timezones"
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-[15px] font-medium text-[#111629] outline-none placeholder:text-slate-400 transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
                    required
                    aria-required="true"
                    placeholder="e.g. Europe/London"
                  />
                  <datalist id="common-timezones">
                    <option value="Europe/London" />
                    <option value="America/New_York" />
                    <option value="Asia/Riyadh" />
                    <option value="Asia/Dubai" />
                    <option value="Europe/Istanbul" />
                  </datalist>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Subjects & specialties</h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="subjects-taught"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Subjects taught</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Add up to six core subjects you teach most often.</p>
                    <ChipsInput
                      inputId="subjects-taught"
                      value={subjects}
                      onChange={setSubjects}
                      suggestions={[
                        "Qur'an Recitation",
                        "Tajweed",
                        "Hifz",
                        "Arabic Language",
                        "Beginner Qur'an",
                        "Ijazah Prep",
                      ]}
                      placeholder="Type and press Enter to add…"
                      maxItems={6}
                      ariaLabel="Subjects taught"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tutor-specialties"
                      className="flex w-full items-center gap-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]"
                    >
                      <span>Specialties</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="mt-1 pl-3 text-sm text-slate-600 leading-snug">Highlight unique approaches or groups you support.</p>
                    <ChipsInput
                      inputId="tutor-specialties"
                      value={specialties}
                      onChange={setSpecialties}
                      suggestions={[
                        "Pronunciation (Makharij)",
                        "Memorization Techniques",
                        "Working with Kids",
                        "Rules Application",
                        "Rhythm & Flow",
                        "Beginners Support",
                        "Exam / Ijazah Prep",
                      ]}
                      placeholder="Type and press Enter to add…"
                      maxItems={6}
                      ariaLabel="Specialties"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="relative hidden lg:block">
          <div className="sticky top-32">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]">
                    <span>Profile tips</span>
                  </div>
                  <ul className="mt-3 space-y-2 pl-4 text-sm text-slate-600">
                    <li>• Write in the first person — “I help students...”</li>
                    <li>• Mention results or testimonials from past learners.</li>
                    <li>• Keep sentences short for easy scanning.</li>
                  </ul>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-[#111629]">
                    <span>Need help?</span>
                  </div>
                  <p className="mt-3 pl-4 text-sm text-slate-500">
                    Email support@hifztutor.com if you need assistance updating your profile or verifying your account.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-[#F7FBE8] p-4 text-sm text-[#111629]">
                <h3 className="text-sm font-semibold">Ready to publish?</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Review your updates, then save to share them with students.
                </p>
                <Button type="submit" className="mt-3 hidden w-full lg:block" disabled={saving || !!avatarError}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                {avatarError ? (
                  <p className="mt-2 text-xs font-medium text-red-600">Fix photo issues before saving.</p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden sm:px-6">
        <div className="space-y-3">
          <div className="rounded-md border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowTips((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-[#111629]"
              aria-expanded={showTips}
            >
              <span>Profile tips</span>
              <span className={`text-base transition-transform ${showTips ? "rotate-180" : "rotate-0"}`}>
                ▾
              </span>
            </button>
            {showTips ? (
              <ul className="border-t border-slate-200 px-3 py-2 pl-4 text-sm text-slate-600">
                <li>• Write in the first person — “I help students...”</li>
                <li>• Mention results or testimonials from past learners.</li>
                <li>• Keep sentences short for easy scanning.</li>
              </ul>
            ) : null}
          </div>
          <div className="rounded-md border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-[#111629]"
              aria-expanded={showHelp}
            >
              <span>Need help?</span>
              <span className={`text-base transition-transform ${showHelp ? "rotate-180" : "rotate-0"}`}>
                ▾
              </span>
            </button>
            {showHelp ? (
              <p className="border-t border-slate-200 px-3 py-2 pl-4 text-sm text-slate-600">
                Email support@hifztutor.com if you need assistance updating your profile or verifying your account.
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={saving || !!avatarError}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {avatarError ? (
            <p className="text-center text-xs font-medium text-red-600">Fix photo issues before saving.</p>
          ) : null}
        </div>
        <div aria-hidden className="pointer-events-none" style={{ height: "env(safe-area-inset-bottom, 0px)", background: "rgba(255,255,255,0.95)" }} />
      </div>
      <PhotoCropModal
        file={selectedFile}
        open={showCrop}
        onClose={() => setShowCrop(false)}
        onApply={(cropped) => {
          setSelectedFile(cropped);
          const url = URL.createObjectURL(cropped);
          setPreviewUrl(url);
          setAvatarError(null);
          setRemoveAvatar(false);
        }}
        onDelete={() => {
          setSelectedFile(null);
          setPreviewUrl(null);
          setAvatarUrl("");
          setRemoveAvatar(true);
        }}
      />
    </form>
  );
}

// --- Helper components ---

function normalizeToken(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function ChipsInput({
  value,
  onChange,
  suggestions,
  placeholder,
  maxItems,
  inputId,
  ariaLabel,
}: {
  value: string[];
  onChange: (items: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  maxItems: number;
  inputId?: string;
  ariaLabel?: string;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addToken(raw: string) {
    const token = normalizeToken(raw);
    if (!token) return;
    const exists = value.some((v) => v.toLowerCase() === token.toLowerCase());
    if (exists) {
      setInput("");
      setError(null);
      return;
    }
    if (value.length >= maxItems) {
      setError(`You can add up to ${maxItems} items.`);
      return;
    }
    onChange([...value, token]);
    setInput("");
    setError(null);
  }

  function removeAt(idx: number) {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addToken(input);
      return;
    }
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
      return;
    }
  }

  const filtered = useMemo(() => {
    const q = input.toLowerCase();
    const picked = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => s.toLowerCase().includes(q))
      .filter((s) => !picked.has(s.toLowerCase()))
      .slice(0, 6);
  }, [input, suggestions, value]);

  return (
    <div>
      <div className="mt-1 w-full rounded-md border px-2 py-2 outline-none focus-within:ring-2 focus-within:ring-[#D3F501]">
        <div className="flex flex-wrap items-center gap-2">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border border-[#CDD5E0] bg-[#F7F8FA] px-2 py-0.5 text-xs text-[#111629]">
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => removeAt(value.indexOf(v))}
                className="rounded p-0.5 hover:bg-gray-100"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 min-w-[140px] border-none bg-transparent py-1 text-sm font-medium text-[#111629] placeholder:text-slate-400 outline-none"
            placeholder={placeholder}
            aria-label={ariaLabel}
          />
        </div>
      </div>
      {error ? (
        <div className="mt-1 text-xs text-red-600">{error}</div>
      ) : null}
      {filtered.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addToken(s)}
              className="rounded-full border border-[#CDD5E0] bg-white px-2 py-0.5 text-xs text-[#111629] hover:bg-[#F7D250]"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CountrySelect({
  options,
  value,
  onChange,
  placeholder,
  required,
  inputId,
}: {
  options: { iso2: string; name: string }[];
  value: string | null;
  onChange: (iso2: string | null) => void;
  placeholder?: string;
  required?: boolean;
  inputId?: string;
}) {
  // Pin a short list of common countries at the top for convenience
  const byIso2 = useMemo(() => {
    const map = new Map<string, { iso2: string; name: string }>();
    for (const c of options) map.set(c.iso2.toUpperCase(), c);
    return map;
  }, [options]);
  const commonOptions = useMemo(
    () => COMMON_COUNTRIES.map((code) => byIso2.get(code)).filter(Boolean) as { iso2: string; name: string }[],
    [byIso2]
  );
  const remainingOptions = useMemo(
    () => options.filter((c) => !COMMON_COUNTRIES.includes(c.iso2.toUpperCase())),
    [options]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function flagEmoji(code: string) {
    if (!code || code.length !== 2) return "";
    const base = 127397; // regional indicator symbol base
    const chars = code
      .toUpperCase()
      .split("")
      .map((ch) => base + ch.charCodeAt(0));
    return String.fromCodePoint(...chars);
  }

  const normalizedOptions = useMemo(() => [...commonOptions, ...remainingOptions], [commonOptions, remainingOptions]);
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) => opt.name.toLowerCase().includes(q) || opt.iso2.toLowerCase().includes(q));
  }, [normalizedOptions, query]);

  const selectedOption = value ? byIso2.get(value.toUpperCase()) ?? null : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        id={inputId}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-[15px] font-medium text-[#111629] outline-none transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select country"
      >
        <span className="flex items-center gap-2">
          {selectedOption ? (
            <>
              <span>{flagEmoji(selectedOption.iso2)}</span>
              <span>{selectedOption.name}</span>
            </>
          ) : (
            <span className="text-slate-400">{placeholder || "Select country"}</span>
          )}
        </span>
        <span className="text-slate-400">▾</span>
      </button>
      {required ? (
        <input tabIndex={-1} className="sr-only" value={value ?? ""} required readOnly aria-hidden="true" />
      ) : null}
      {open ? (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search country..."
              className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-[#D3F501] focus:ring-1 focus:ring-[#D3F501]"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.iso2.toUpperCase() === (value ?? "").toUpperCase();
                return (
                  <li key={opt.iso2}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.iso2);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        isSelected ? "bg-slate-100 text-[#111629]" : "hover:bg-slate-50"
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="text-lg leading-none">{flagEmoji(opt.iso2)}</span>
                      <span>{opt.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Top-level constant: common countries to pin in the dropdown
const COMMON_COUNTRIES: readonly string[] = ["GB", "US", "SA", "AE", "TR", "PK", "IN"];

// --- Photo crop modal ---
const CROP_CANVAS_SIZE = 280;
const MIN_CROP_SIZE = 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function PhotoCropModal({
  file,
  open,
  onClose,
  onApply,
  onDelete,
}: {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onApply: (cropped: File) => void;
  onDelete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; size: number }>(() => {
    const defaultSize = CROP_CANVAS_SIZE * 0.75;
    const start = (CROP_CANVAS_SIZE - defaultSize) / 2;
    return { x: start, y: start, size: defaultSize };
  });
  const interactionRef = useRef<{
    mode: "move" | "resize";
    originX: number;
    originY: number;
    crop: { x: number; y: number; size: number };
  } | null>(null);
  const drawInfoRef = useRef<{
    scale: number;
    offsetX: number;
    offsetY: number;
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const state = interactionRef.current;
    if (!state) return;
    const dx = event.clientX - state.originX;
    const dy = event.clientY - state.originY;
    if (state.mode === "move") {
      const maxPos = CROP_CANVAS_SIZE - state.crop.size;
      const nextX = clamp(state.crop.x + dx, 0, maxPos);
      const nextY = clamp(state.crop.y + dy, 0, maxPos);
      setCrop((prev) => {
        if (prev.x === nextX && prev.y === nextY) return prev;
        return { ...prev, x: nextX, y: nextY };
      });
      return;
    }

    const dominant = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    const maxSize = Math.min(
      CROP_CANVAS_SIZE - state.crop.x,
      CROP_CANVAS_SIZE - state.crop.y
    );
    const nextSize = clamp(state.crop.size + dominant, MIN_CROP_SIZE, maxSize);
    setCrop((prev) => {
      if (prev.size === nextSize) return prev;
      return { ...prev, size: nextSize };
    });
  }, []);

  const endInteraction = useCallback(() => {
    if (interactionRef.current) {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endInteraction);
      interactionRef.current = null;
    }
  }, [handlePointerMove]);

  useEffect(() => {
    if (!open || !file) {
      sourceImageRef.current = null;
      drawInfoRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext("2d")) return;

    const defaultSize = CROP_CANVAS_SIZE * 0.75;
    const start = (CROP_CANVAS_SIZE - defaultSize) / 2;
    setCrop({ x: start, y: start, size: defaultSize });

    const img = new Image();
    sourceImageRef.current = img;
    let objectUrl: string | null = null;

    img.onload = () => {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const context = canvasEl.getContext("2d");
      if (!context) return;
      const size = CROP_CANVAS_SIZE;
      canvasEl.width = size;
      canvasEl.height = size;
      const { naturalWidth, naturalHeight } = img;
      const scale = Math.max(size / naturalWidth, size / naturalHeight);
      const scaledWidth = naturalWidth * scale;
      const scaledHeight = naturalHeight * scale;
      const offsetX = (size - scaledWidth) / 2;
      const offsetY = (size - scaledHeight) / 2;
      drawInfoRef.current = { scale, offsetX, offsetY, naturalWidth, naturalHeight };
      context.clearRect(0, 0, size, size);
      context.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
    };

    img.onerror = () => {
      drawInfoRef.current = null;
    };

    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      sourceImageRef.current = null;
      drawInfoRef.current = null;
    };
  }, [file, open]);

  useEffect(() => {
    return () => {
      if (interactionRef.current) {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", endInteraction);
        interactionRef.current = null;
      }
    };
  }, [endInteraction, handlePointerMove]);

  function startInteraction(e: React.PointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    if (!sourceImageRef.current) return;
    interactionRef.current = {
      mode,
      originX: e.clientX,
      originY: e.clientY,
      crop,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endInteraction);
  }

  async function handleApply() {
    if (!file) return;
    const imgEl = sourceImageRef.current;
    const info = drawInfoRef.current;
    if (!imgEl || !info) return;
    const { scale, offsetX, offsetY, naturalWidth, naturalHeight } = info;
    const cropSizeSource = crop.size / scale;
    const rawX = (crop.x - offsetX) / scale;
    const rawY = (crop.y - offsetY) / scale;
    const sourceX = clamp(rawX, 0, Math.max(0, naturalWidth - cropSizeSource));
    const sourceY = clamp(rawY, 0, Math.max(0, naturalHeight - cropSizeSource));

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CROP_CANVAS_SIZE;
    exportCanvas.height = CROP_CANVAS_SIZE;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      imgEl,
      sourceX,
      sourceY,
      cropSizeSource,
      cropSizeSource,
      0,
      0,
      CROP_CANVAS_SIZE,
      CROP_CANVAS_SIZE
    );

    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to crop image"));
      }, type, 0.92);
    });
    const cropped = new File([
      blob,
    ], file.name.replace(/(\.[a-z0-9]+)$/i, "-cropped$1"), { type });
    onApply(cropped);
    onClose();
  }


  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 ${open ? "flex" : "hidden"} items-center justify-center bg-black/40 p-4`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-[#111629]">Edit thumbnail</h3>
        <div className="mt-4 grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
          <div className="flex justify-center md:justify-start">
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                className="h-[280px] w-[280px] rounded-md border bg-black/5"
              />
              <div
                role="presentation"
                className="absolute border-2 border-dashed border-slate-300"
                style={{
                  left: `${crop.x}px`,
                  top: `${crop.y}px`,
                  width: `${crop.size}px`,
                  height: `${crop.size}px`,
                  boxShadow: "0 0 0 1600px rgba(17,22,41,0.45)",
                  cursor: "move",
                }}
                onPointerDown={(e) => startInteraction(e, "move")}
              >
                <div
                  role="presentation"
                  className="absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm border border-white bg-[#F5F7FB]"
                  onPointerDown={(e) => startInteraction(e, "resize")}
                />
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Drag the square to adjust what shows in your profile thumbnail.</p>
            <p className="mt-2">Use the corner handle to resize the focus area until it feels right.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-[#111629] hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <Button type="button" onClick={handleApply} disabled={!sourceImageRef.current}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
