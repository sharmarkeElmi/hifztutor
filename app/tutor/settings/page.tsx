"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsShell, { type SettingsTab } from "../../components/settings/SettingsShell";

// --- Tabs config (tutor) ---
const TABS: SettingsTab[] = [
  { key: "profile", label: "Profile", href: "/tutor/settings?tab=profile" },
  { key: "account", label: "Account", href: "/tutor/settings?tab=account" },
  { key: "notifications", label: "Notifications", href: "/tutor/settings?tab=notifications" },
  { key: "teaching", label: "Teaching Settings", href: "/tutor/settings?tab=teaching" },
  { key: "earnings", label: "Earnings & Payouts", href: "/tutor/settings?tab=earnings" },
  { key: "privacy", label: "Privacy & Safety", href: "/tutor/settings?tab=privacy" },
];

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc ? <p className="mt-1 text-sm text-slate-600">{desc}</p> : null}
      <div className="mt-3 h-px w-full bg-slate-200" />
    </div>
  );
}

// Shared types (align with student page)
type Digest = "immediate" | "daily" | "weekly";

type NotificationsState = {
  lessonReminders: boolean;
  messages: boolean;
  bookings: boolean;
  payouts: boolean;
  digest: Digest;
  quietHours: boolean;
};

type NotificationBooleanKey = Exclude<keyof NotificationsState, "digest" | "quietHours">;

type ProfileState = {
  fullName: string;
  displayName: string;
  timezone: string;
  locale: string;
  languages: string;
  bio: string;
  avatarUrl?: string;
  headline?: string;
  languagesCSV?: string;
  rate?: string; // plain number string in UI
  countryCode?: string; // ISO2
  years?: string; // numeric string in UI
  photoUrl?: string;
};

export default function TutorSettingsPage() {
  const params = useSearchParams();
  const activeKey = useMemo(() => {
    const key = params.get("tab") || "profile";
    return TABS.some((t) => t.key === key) ? key : "profile";
  }, [params]);

  // Local UI state placeholders
  const [profile, setProfile] = useState<ProfileState>({
    fullName: "",
    displayName: "",
    timezone: "",
    locale: "",
    languages: "",
    bio: "",
  });

  const [account, setAccount] = useState({
    email: "",
    phone: "",
  });

  const [notifications, setNotifications] = useState<NotificationsState>({
    lessonReminders: true,
    messages: true,
    bookings: true,
    payouts: true,
    digest: "daily",
    quietHours: false,
  });

  const EMAIL_ROWS: { key: NotificationBooleanKey; label: string }[] = [
    { key: "lessonReminders", label: "Lesson reminders" },
    { key: "messages", label: "Messages" },
    { key: "bookings", label: "New bookings & changes" },
    { key: "payouts", label: "Payout notifications" },
  ];

  const titleByKey: Record<string, string> = {
    profile: "Profile",
    account: "Account",
    notifications: "Notifications",
    teaching: "Teaching Settings",
    earnings: "Earnings & Payouts",
    privacy: "Privacy & Safety",
  };

  return (
    <SettingsShell
      role="tutor"
      tabs={TABS}
      activeKey={activeKey}
      title={titleByKey[activeKey]}
      description={
        activeKey === "profile"
          ? "Update your name, photo, languages, and teaching bio."
          : activeKey === "account"
          ? "Manage your email, password, and sign-in security."
          : activeKey === "notifications"
          ? "Choose which updates you receive and how often."
          : activeKey === "teaching"
          ? "Set your default durations, rates, and policies."
          : activeKey === "earnings"
          ? "Connect payouts and review history."
          : activeKey === "privacy"
          ? "Control visibility, data export, and account deletion."
          : undefined
      }
    >
      {activeKey === "profile" && (
        <div className="space-y-6">
          <SectionHeader title="General" desc="Update your public information. Shown on your tutor profile and in search results." />

          {/* Profiles table fields */}
          <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Full name</span>
                <input
                  value={profile.fullName}
                  onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                  placeholder="e.g. Ustadh Ahmed"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Avatar URL (optional)</span>
                <input
                  value={profile.avatarUrl ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                  placeholder="https://…"
                />
              </label>
            </div>
          </div>

          <SectionHeader title="Tutor details" desc="Specific details students will see when booking you." />

          {/* Tutor-specific fields (tutor_profiles) */}
          <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Headline</span>
              <input
                value={profile.headline ?? ''}
                onChange={(e) => setProfile((p) => ({ ...p, headline: e.target.value }))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                placeholder="Qur’an teacher • 3+ years experience"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Short bio</span>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                rows={5}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                placeholder="Tell students about your approach and experience…"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium">Languages (CSV)</span>
                <input
                  value={profile.languagesCSV ?? profile.languages}
                  onChange={(e) => setProfile((p) => ({ ...p, languagesCSV: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                  placeholder="Arabic (native), English (fluent)"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Hourly rate</span>
                <div className="relative">
                  <input
                    value={profile.rate ?? ''}
                    onChange={(e) => setProfile((p) => ({ ...p, rate: e.target.value.replace(/[^0-9.]/g, '') }))}
                    className="mt-1 w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                    placeholder="20"
                    inputMode="numeric"
                  />
                  <span className="absolute right-2 top-[10px] text-xs text-slate-500">/hr</span>
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Country (ISO2)</span>
                <input
                  value={profile.countryCode ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-[#F7D250]"
                  placeholder="GB"
                  maxLength={2}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Years experience</span>
                <input
                  value={profile.years ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, years: e.target.value.replace(/[^0-9]/g, '') }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                  placeholder="3"
                  inputMode="numeric"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Photo URL (optional)</span>
                <input
                  value={profile.photoUrl ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, photoUrl: e.target.value }))}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F7D250]"
                  placeholder="https://…"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
            <button className="rounded-md px-4 py-2 text-sm text-[#111629]" style={{ backgroundColor: '#F7D250' }}>
              Save changes
            </button>
          </div>
        </div>
      )}

      {activeKey === "account" && (
        <div className="space-y-6">
          <SectionHeader title="Email & password" desc="Update your sign-in details." />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                placeholder="name@example.com"
                value={account.email}
                onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
              />
              <p className="mt-1 text-xs text-slate-500">We’ll show verification status here.</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Phone (optional)</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                placeholder="+44 7…"
                value={account.phone}
                onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Current password</span>
              <input type="password" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">New password</span>
              <input type="password" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Confirm password</span>
              <input type="password" className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]" />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              className="rounded-md px-4 py-2 text-sm text-[#111629]"
              style={{ backgroundColor: "#F7D250" }}
            >
              Update password
            </button>
          </div>

          <SectionHeader title="Two-factor authentication" desc="Add an extra layer of security with an authenticator app." />
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">TOTP (Authenticator app) — coming soon</p>
          </div>
        </div>
      )}

      {activeKey === "notifications" && (
        <div className="space-y-6">
          <SectionHeader title="Email notifications" desc="Choose which emails you receive." />
          <div className="grid gap-3">
            {EMAIL_ROWS.map((row) => (
              <label key={row.key} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">{row.label}</span>
                <input
                  type="checkbox"
                  checked={notifications[row.key]}
                  onChange={(e) => setNotifications((n) => ({ ...n, [row.key]: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>

          <SectionHeader title="Digest & quiet hours" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Digest frequency</span>
              <select
                value={notifications.digest}
                onChange={(e) => setNotifications((n) => ({ ...n, digest: e.target.value as Digest }))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
              >
                <option value="immediate">Immediate</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="flex items-center justify-between rounded-md border p-3 mt-6 sm:mt-0">
              <span className="text-sm">Enable quiet hours</span>
              <input
                type="checkbox"
                checked={notifications.quietHours}
                onChange={(e) => setNotifications((n) => ({ ...n, quietHours: e.target.checked }))}
                className="h-4 w-4"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              className="rounded-md px-4 py-2 text-sm text-[#111629]"
              style={{ backgroundColor: "#F7D250" }}
            >
              Save preferences
            </button>
          </div>
        </div>
      )}

      {activeKey === "teaching" && (
        <div className="space-y-6">
          <SectionHeader title="Defaults" desc="These defaults appear in your availability and booking flows." />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Default duration</span>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]">
                <option>30 minutes</option>
                <option>45 minutes</option>
                <option>60 minutes</option>
                <option>90 minutes</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Default rate</span>
              <input
                type="number"
                min={0}
                placeholder="£/hour"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Buffer between lessons</span>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]">
                <option>None</option>
                <option>5 minutes</option>
                <option>10 minutes</option>
                <option>15 minutes</option>
              </select>
            </label>
          </div>

          <SectionHeader title="Policies" desc="Cancellation and rescheduling rules students agree to when booking." />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Cancellation policy</span>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]">
                <option>Flexible (free up to 24h)</option>
                <option>Moderate (free up to 48h)</option>
                <option>Strict (non-refundable)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Trial lesson pricing</span>
              <input
                type="number"
                min={0}
                placeholder="£/30m"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
            <button className="ml-2 rounded-md px-4 py-2 text-sm text-[#111629]" style={{ backgroundColor: "#F7D250" }}>
              Save defaults
            </button>
          </div>
        </div>
      )}

      {activeKey === "earnings" && (
        <div className="space-y-6">
          <SectionHeader title="Payouts" desc="Connect your Stripe account to receive payouts." />
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Stripe Connect onboarding — coming soon</p>
          </div>
          <SectionHeader title="History" />
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Payout history and downloadable statements — coming soon</p>
          </div>
        </div>
      )}

      {activeKey === "privacy" && (
        <div className="space-y-6">
          <SectionHeader title="Data & privacy" desc="Control your data and account visibility." />
          <div className="grid gap-3">
            <label className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">Profile visibility</span>
              <select className="rounded-md border px-2 py-1 text-sm">
                <option>Public</option>
                <option>Limited</option>
                <option>Private</option>
              </select>
            </label>
          </div>

          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Export your data — coming soon</p>
          </div>

          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Delete account — soft delete with a 30‑day recovery window (coming soon)</p>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
