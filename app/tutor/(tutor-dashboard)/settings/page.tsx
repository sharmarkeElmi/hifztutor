"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsShell, { type SettingsTab } from "@shells/SettingsShell";
import { Button } from "@components/ui/button";

import PasswordForm, { type PasswordFormValues } from "@features/settings/components/PasswordForm";
import EmailChangeForm, { type EmailChangeValues } from "@features/settings/components/EmailChangeForm";
import NotificationsForm, { type NotificationsValues } from "@features/settings/components/NotificationsForm";
import useUpdatePassword from "@features/settings/hooks/useUpdatePassword";
import useChangeEmail from "@features/settings/hooks/useChangeEmail";
import useUpdateNotifications from "@features/settings/hooks/useUpdateNotifications";
// --- Tabs config (tutor) ---
const TABS: SettingsTab[] = [
  { key: "email", label: "Email", href: "/tutor/settings?tab=email" },
  { key: "password", label: "Password", href: "/tutor/settings?tab=password" },
  { key: "notifications", label: "Notifications", href: "/tutor/settings?tab=notifications" },
  { key: "delete", label: "Delete Account", href: "/tutor/settings?tab=delete" },
];

type Digest = "immediate" | "daily" | "weekly";
type NotificationsState = {
  lessonReminders: boolean;
  messages: boolean;
  bookings: boolean;
  payouts: boolean;
  digest: Digest;
  quietHours: boolean;
};

type StatusState = { type: "success" | "error"; message: string } | null;

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function TutorSettingsPage() {
  const updatePassword = useUpdatePassword();
  const changeEmail = useChangeEmail();
  const updateNotifications = useUpdateNotifications();
  const params = useSearchParams();
  const activeKey = useMemo(() => {
    const key = params.get("tab") || "email";
    return TABS.some((t) => t.key === key) ? key : "email";
  }, [params]);

  const [status, setStatus] = useState<StatusState>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string>("");

  const [notifications, setNotifications] = useState<NotificationsState>({
    lessonReminders: true,
    messages: true,
    bookings: true,
    payouts: true,
    digest: "daily",
    quietHours: false,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nRes, pRes] = await Promise.all([
          fetch("/api/settings/notifications", { credentials: "include" }),
          fetch("/api/settings/profile", { credentials: "include" }),
        ]);
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
        if (!cancelled && pRes.ok) {
          const p = await pRes.json();
          setCurrentEmail(p.email ?? "");
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

  // --- Submission handlers routed to feature components ---

  async function submitEmail({ currentEmail: submittedEmail, newEmail }: EmailChangeValues) {
    setSavingEmail(true);
    setStatus(null);
    try {
      if (!submittedEmail || !newEmail) {
        setStatus({ type: "error", message: "Please enter valid email addresses." });
        setSavingEmail(false);
        return;
      }
      const submittedNormalized = submittedEmail.trim().toLowerCase();
      const storedNormalized = (currentEmail ?? "").trim().toLowerCase();
      if (!storedNormalized || submittedNormalized !== storedNormalized) {
        setStatus({ type: "error", message: "Current email does not match our records." });
        setSavingEmail(false);
        return;
      }
      if (submittedNormalized === newEmail.trim().toLowerCase()) {
        setStatus({ type: "error", message: "Please enter a different email address." });
        setSavingEmail(false);
        return;
      }

      const r = (await changeEmail({ currentEmail: submittedEmail, newEmail })) as {
        maybeVerificationRequired?: boolean;
      } | void;
      setStatus({
        type: "success",
        message: r?.maybeVerificationRequired
          ? "Email updated. Check your inbox if verification is required."
          : "Email updated.",
      });
      setCurrentEmail(newEmail);
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) || "Could not update email" });
    } finally {
      setSavingEmail(false);
    }
  }

  async function submitPassword(values: PasswordFormValues) {
    setSavingPassword(true);
    setStatus(null);
    try {
      if (!values.newPassword || values.newPassword.length < 8) {
        setStatus({ type: "error", message: "Password must be at least 8 characters." });
        return;
      }
      if (values.newPassword !== values.confirmNewPassword) {
        setStatus({ type: "error", message: "Passwords do not match" });
        return;
      }
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      });
      setStatus({ type: "success", message: "Password updated" });
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) || "Could not update password" });
    } finally {
      setSavingPassword(false);
    }
  }

  async function submitNotifications(values: NotificationsValues) {
    setSavingNotifications(true);
    setStatus(null);
    try {
      await updateNotifications({
        lessonReminders: values.lessonReminders,
        marketingEmails: values.marketingEmails,
      });
      setStatus({ type: "success", message: "Notification preferences saved" });
      // Merge back only the fields present on the form
      setNotifications((prev) => ({
        ...prev,
        lessonReminders: values.lessonReminders,
        // reflect marketingEmails in productUpdates analogue if/when added to state
      }));
    } catch (err: unknown) {
      setStatus({ type: "error", message: getErrorMessage(err) || "Could not save notifications" });
    } finally {
      setSavingNotifications(false);
    }
  }

  const titleByKey: Record<string, string> = {
    email: "Email",
    password: "Password",
    notifications: "Notifications",
    delete: "Delete Account",
  };

  return (
    <SettingsShell
      tabs={TABS}
      activeKey={activeKey}
      title={titleByKey[activeKey]}
      description={
        activeKey === "email"
          ? "Manage your email."
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
        <EmailChangeForm
          onSubmit={submitEmail}
          isSubmitting={savingEmail}
          currentEmail={currentEmail}
        />
      )}

      {activeKey === "password" && (
        <PasswordForm onSubmit={submitPassword} isSubmitting={savingPassword} />
      )}

      {activeKey === "notifications" && (
        <NotificationsForm
          initialValues={{
            marketingEmails: false, // not tracked explicitly in page state
            lessonReminders: notifications.lessonReminders,
          }}
          onSubmit={submitNotifications}
          isSubmitting={savingNotifications}
        />
      )}

      {activeKey === "delete" && (
        <div className="space-y-6">
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Soft delete with a 30‑day recovery window — coming soon.</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="destructive">Delete my account</Button>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
