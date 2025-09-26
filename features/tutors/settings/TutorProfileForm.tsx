"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@components/ui/button";

export default function TutorProfileForm() {
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

  // Countries for searchable select
  type Country = { iso2: string; name: string };
  const [countries, setCountries] = useState<Country[]>([]);

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
        full_name: fullName || null,
        avatar_url: newAvatarUrl,
      })
      .eq("id", user.id);

    if (pErr) {
      setError(pErr.message);
      setSaving(false);
      return;
    }

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
        subjects: subjects,
        specialties: specialties,
        time_zone: timeZone || null,
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

    setSaving(false);
    router.back();
  }

  if (loading) {
    return (
      <div className="p-2">
        <div className="animate-pulse text-sm text-muted-foreground">Loading profile…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="mt-2 space-y-6">
      {/* Profile image */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">Profile image</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[256px_1fr] md:items-start">
          <div className="flex flex-col items-start gap-3">
            <div className="h-64 w-64 overflow-hidden rounded-md border bg-white shadow-sm">
              {previewUrl || avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl || avatarUrl}
                  alt={`${fullName || "Tutor"} avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-base font-semibold text-muted-foreground">
                  {(fullName || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCrop(true)}
              className="text-sm font-medium text-[#111629] underline underline-offset-4 decoration-[#D3F501] disabled:opacity-40"
              disabled={!(previewUrl || avatarUrl)}
              aria-label="Edit photo"
            >
              Edit
            </button>
          </div>

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
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#111629] px-4 py-3 text-base font-semibold text-[#111629] hover:bg-slate-50 focus:outline-none"
              aria-label="Upload photo"
            >
              {/* icon from /public */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/upload-photo-icon.svg" alt="" className="h-5 w-5" />
              Upload photo
            </button>
            <div className="mt-3 text-sm text-slate-400">
              <div>Maximum size – 2MB</div>
              <div>JPG or PNG format</div>
            </div>
            {avatarError ? (
              <div className="mt-2 text-sm text-red-600">{avatarError}</div>
            ) : null}
          </div>
        </div>
      </section>

      {/* General (profiles) */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">General</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
              placeholder="e.g. Ustadh Ahmed"
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
              className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
              placeholder="Qur’an teacher • 3+ years experience"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Short bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-[#D3F501]"
              placeholder="Tell students about your approach and experience…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Languages (CSV)</label>
              <input
                value={languagesCSV}
                onChange={(e) => setLanguagesCSV(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
                placeholder="Arabic (native), English (fluent)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Hourly rate</label>
              <div className="relative">
                <input
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="mt-1 h-10 w-full rounded-md border px-3 pr-10 outline-none focus:ring-2 focus:ring-[#D3F501]"
                  placeholder="20"
                  inputMode="numeric"
                />
                <span className="absolute right-2 top-[10px] text-sm text-muted-foreground">/hr</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Country</label>
              <CountrySelect
                options={countries}
                value={countryCode}
                onChange={setCountryCode}
                placeholder="Select country"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Years experience</label>
              <input
                value={years}
                onChange={(e) => setYears(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
                placeholder="3"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Photo URL (optional)</label>
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
                placeholder="https://…"
              />
            </div>
          </div>

          {/* Subjects taught */}
          <div>
            <label className="block text-sm font-medium">Subjects taught</label>
            <ChipsInput
              value={subjects}
              onChange={setSubjects}
              suggestions={["Qur'an Recitation","Tajweed","Hifz","Arabic Language","Beginner Qur'an","Ijazah Prep"]}
              placeholder="Type and press Enter to add…"
              maxItems={6}
            />
          </div>

          {/* Specialties */}
          <div>
            <label className="block text-sm font-medium">Specialties</label>
            <ChipsInput
              value={specialties}
              onChange={setSpecialties}
              suggestions={["Pronunciation (Makharij)","Memorization Techniques","Working with Kids","Rules Application","Rhythm & Flow","Beginners Support","Exam / Ijazah Prep"]}
              placeholder="Type and press Enter to add…"
              maxItems={6}
            />
          </div>

          {/* Time zone */}
          <div>
            <label className="block text-sm font-medium">Time zone (IANA)</label>
            <input
              list="common-timezones"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
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
      </section>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" variant="default" disabled={saving || !!avatarError}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
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
}: {
  value: string[];
  onChange: (items: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  maxItems: number;
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 min-w-[140px] border-none outline-none py-1 text-sm"
            placeholder={placeholder}
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
}: {
  options: { iso2: string; name: string }[];
  value: string | null;
  onChange: (iso2: string | null) => void;
  placeholder?: string;
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

  function flagEmoji(code: string) {
    if (!code || code.length !== 2) return "";
    const base = 127397; // regional indicator symbol base
    const chars = code
      .toUpperCase()
      .split("")
      .map((ch) => base + ch.charCodeAt(0));
    return String.fromCodePoint(...chars);
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      className="mt-1 h-10 w-full rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501] bg-white"
      aria-label="Select country"
    >
      <option value="">{placeholder || "Select country"}</option>
      {commonOptions.length > 0 ? (
        <optgroup label="Common">
          {commonOptions.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {`${flagEmoji(c.iso2)} ${c.name} (${c.iso2})`}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="All countries">
        {remainingOptions.map((c) => (
          <option key={c.iso2} value={c.iso2}>
            {`${flagEmoji(c.iso2)} ${c.name} (${c.iso2})`}
          </option>
        ))}
      </optgroup>
    </select>
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
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
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
    if (open && file) {
      const url = URL.createObjectURL(file);
      setImgUrl(url);
      const defaultSize = CROP_CANVAS_SIZE * 0.75;
      const start = (CROP_CANVAS_SIZE - defaultSize) / 2;
      setCrop({ x: start, y: start, size: defaultSize });
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setImgUrl(null);
  }, [file, open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const imgEl = imgRef.current;
    if (!canvas || !imgEl || !imgUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = CROP_CANVAS_SIZE;
    canvas.width = size;
    canvas.height = size;

    const draw = () => {
      const { naturalWidth, naturalHeight } = imgEl;
      if (!naturalWidth || !naturalHeight) return;
      const scale = Math.max(size / naturalWidth, size / naturalHeight);
      const scaledWidth = naturalWidth * scale;
      const scaledHeight = naturalHeight * scale;
      const offsetX = (size - scaledWidth) / 2;
      const offsetY = (size - scaledHeight) / 2;
      drawInfoRef.current = { scale, offsetX, offsetY, naturalWidth, naturalHeight };
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(imgEl, offsetX, offsetY, scaledWidth, scaledHeight);
    };

    if (imgEl.complete) {
      draw();
      return;
    }

    imgEl.addEventListener("load", draw);
    return () => {
      imgEl.removeEventListener("load", draw);
    };
  }, [imgUrl]);

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
    const imgEl = imgRef.current;
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
    const blob: Blob = await new Promise((resolve) =>
      exportCanvas.toBlob((b) => resolve(b as Blob), type, 0.92)
    );
    const cropped = new File(
      [blob],
      file.name.replace(/(\.[a-z0-9]+)$/i, "-cropped$1"),
      { type }
    );
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
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={imgUrl}
              alt="to crop"
              className="hidden"
            />
          ) : null}
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
          <Button type="button" onClick={handleApply}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
