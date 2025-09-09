"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsShell, { type SettingsTab } from "@shells/SettingsShell";

// --- Tabs config (tutor) ---
const TABS: SettingsTab[] = [
  { key: "email", label: "Email", href: "/tutor/settings?tab=email" },
  { key: "password", label: "Password", href: "/tutor/settings?tab=password" },
  { key: "notifications", label: "Notifications", href: "/tutor/settings?tab=notifications" },
  { key: "delete", label: "Delete Account", href: "/tutor/settings?tab=delete" },
];

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[20px] sm:text-2xl font-semibold leading-snug">{title}</h2>
      {desc ? <p className="mt-1.5 text-[15px] text-slate-600 leading-relaxed">{desc}</p> : null}
      <div className="mt-4 h-px w-full bg-slate-200" />
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

export default function TutorSettingsPage() {
  const params = useSearchParams();
  const activeKey = useMemo(() => {
    const key = params.get("tab") || "email";
    return TABS.some((t) => t.key === key) ? key : "email";
  }, [params]);

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

  type StatusState = { type: "success" | "error"; message: string } | null;
  const [status, setStatus] = useState<StatusState>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  const EMAIL_ROWS: { key: NotificationBooleanKey; label: string }[] = [
    { key: "lessonReminders", label: "Lesson reminders" },
    { key: "messages", label: "Messages" },
    { key: "bookings", label: "New bookings & changes" },
    { key: "payouts", label: "Payout notifications" },
  ];

  const titleByKey: Record<string, string> = {
    email: "Email",
    password: "Password",
    notifications: "Notifications",
    delete: "Delete Account",
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nRes = await fetch("/api/settings/notifications", { credentials: "include" });
        if (!cancelled && nRes.ok) {
          const n = await nRes.json();
          setNotifications({
            lessonReminders: !!n.lesson_reminders,
            messages: !!n.messages,
            bookings: n.bookings ?? true,
            payouts: n.payouts ?? true,
            digest: (n.digest as Digest) ?? "daily",
            quietHours: !!n.quiet_hours,
          });
        }
      } catch {
        // keep UI usable
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  async function handleUpdateEmail() {
    setSavingEmail(true);
    setStatus(null);
    try {
      if (!account.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(account.email)) {
        setStatus({ type: "error", message: "Please enter a valid email address." });
        return;
      }
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: account.email }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; maybeVerificationRequired?: boolean };
      if (!res.ok) throw new Error(j.error || (res.status === 401 ? "Not signed in" : "Failed"));
      setStatus({
        type: "success",
        message: j.maybeVerificationRequired
          ? "Email updated. Check your inbox if verification is required."
          : "Email updated.",
      });
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) || "Could not update email" });
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleUpdatePassword() {
    setSavingPassword(true);
    setStatus(null);
    try {
      if (!passwords.new || passwords.new.length < 8) {
        setStatus({ type: "error", message: "Password must be at least 8 characters." });
        return;
      }
      if (passwords.new !== passwords.confirm) {
        setStatus({ type: "error", message: "Passwords do not match" });
        return;
      }
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: passwords.new }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || (res.status === 401 ? "Not signed in" : "Failed"));
      setStatus({ type: "success", message: "Password updated" });
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) || "Could not update password" });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotifications(true);
    setStatus(null);
    try {
      const payload = {
        lesson_reminders: notifications.lessonReminders,
        messages: notifications.messages,
        receipts: true, // tutors may still want receipts on by default
        product_updates: false,
        digest: notifications.digest,
        quiet_hours: notifications.quietHours,
      } as const;
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || (res.status === 401 ? "Not signed in" : "Failed"));
      setStatus({ type: "success", message: "Notification preferences saved" });
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) || "Could not save notifications" });
    } finally {
      setSavingNotifications(false);
    }
  }

  return (
    <SettingsShell
      tabs={TABS}
      activeKey={activeKey}
      title={titleByKey[activeKey]}
      description={
        activeKey === "email"
          ? "Manage your email and recovery phone."
          : activeKey === "password"
          ? "Change your password."
          : activeKey === "notifications"
          ? "Choose which updates you receive and how often."
          : activeKey === "delete"
          ? "Permanently delete your account."
          : undefined
      }
    >
      {status ? (
        <div
          role="status"
          className={`mb-4 rounded-md border p-3 text-[15px] ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      {activeKey === "email" && (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-[15px] sm:text-base font-medium">Email</span>
              <input
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base leading-tight focus:outline-none focus:ring-2 focus:ring-[#D3F501] focus:border-[#D3F501]"
                value={account.email}
                onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-[15px] sm:text-base font-medium">Phone (optional)</span>
              <input
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base leading-tight focus:outline-none focus:ring-2 focus:ring-[#D3F501] focus:border-[#D3F501]"
                value={account.phone}
                onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleUpdateEmail}
              disabled={savingEmail}
              className="rounded-md px-4 py-2 text-base font-medium text-black bg-[#D3F501] border-2 border-black hover:shadow-md disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition"
            >
              {savingEmail ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeKey === "password" && (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="text-[15px] sm:text-base font-medium">Current password</span>
              <input
                type="password"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base leading-tight focus:outline-none focus:ring-2 focus:ring-[#D3F501] focus:border-[#D3F501]"
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-[15px] sm:text-base font-medium">New password</span>
              <input
                type="password"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base leading-tight focus:outline-none focus:ring-2 focus:ring-[#D3F501] focus:border-[#D3F501]"
                value={passwords.new}
                onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-[15px] sm:text-base font-medium">Confirm password</span>
              <input
                type="password"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base leading-tight focus:outline-none focus:ring-2 focus:ring-[#D3F501] focus:border-[#D3F501]"
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleUpdatePassword}
              disabled={savingPassword}
              className="rounded-md px-4 py-2 text-base font-medium text-black bg-[#D3F501] border-2 border-black hover:shadow-md disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition"
            >
              {savingPassword ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeKey === "notifications" && (
        <div className="space-y-6">
          <div className="grid gap-3.5">
            {EMAIL_ROWS.map((row) => (
              <label key={row.key} className="flex items-center justify-between rounded-md border p-3.5">
                <span className="text-[15px] sm:text-base">{row.label}</span>
                <input
                  type="checkbox"
                  checked={notifications[row.key]}
                  onChange={(e) => setNotifications((n) => ({ ...n, [row.key]: e.target.checked }))}
                  className="h-5 w-5"
                />
              </label>
            ))}
          </div>

          <SectionHeader title="Surveys and interviews" desc="Earn rewards by offering feedback on your teaching experience." />
          <div className="rounded-md border p-4 bg-white">
            <p className="text-[15px] text-slate-600 leading-relaxed">Occasionally we&apos;ll invite you to share feedback in exchange for rewards.</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveNotifications}
              disabled={savingNotifications}
              className="rounded-md px-4 py-2 text-base font-medium text-black bg-[#D3F501] border-2 border-black hover:shadow-md disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition"
            >
              {savingNotifications ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeKey === "delete" && (
        <div className="space-y-6">
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Soft delete with a 30‑day recovery window — coming soon.</p>
          </div>
          <div className="flex justify-end">
            <button className="rounded-md px-4 py-2 text-sm text-white" style={{ backgroundColor: "#e11d48" }}>
              Delete my account
            </button>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
