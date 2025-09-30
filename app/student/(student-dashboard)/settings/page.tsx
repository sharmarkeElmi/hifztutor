"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsShell, { type SettingsTab } from "@shells/SettingsShell";
import { Button } from "@components/ui/button";
import useUpdateProfile from "@features/settings/hooks/useUpdateProfile";
import useUpdatePassword from "@features/settings/hooks/useUpdatePassword";
import useChangeEmail from "@features/settings/hooks/useChangeEmail";
import useUpdateNotifications from "@features/settings/hooks/useUpdateNotifications";

// NEW: feature components (extracted forms)
import ProfileForm, { type ProfileFormValues } from "@features/settings/components/ProfileForm";
import PasswordForm, { type PasswordFormValues } from "@features/settings/components/PasswordForm";
import EmailChangeForm, { type EmailChangeValues } from "@features/settings/components/EmailChangeForm";
import NotificationsForm, { type NotificationsValues } from "@features/settings/components/NotificationsForm";

// --- Tabs config (student) ---
const TABS: SettingsTab[] = [
  { key: "account", label: "Account", href: "/student/settings?tab=account" },
  { key: "password", label: "Password", href: "/student/settings?tab=password" },
  { key: "email", label: "Email", href: "/student/settings?tab=email" },
  { key: "payment_methods", label: "Payment Methods", href: "/student/settings?tab=payment_methods" },
  { key: "payment_history", label: "Payment History", href: "/student/settings?tab=payment_history" },
  { key: "notifications", label: "Notifications", href: "/student/settings?tab=notifications" },
  { key: "delete", label: "Delete Account", href: "/student/settings?tab=delete" },
];

type Digest = "immediate" | "daily" | "weekly";
type NotificationsState = {
  lessonReminders: boolean;
  messages: boolean;
  receipts: boolean;
  productUpdates: boolean;
  digest: Digest;
  quietHours: boolean;
};

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type StudentProfileState = {
  fullName: string;
  displayName: string;
  timezone: string;
  locale: string;
  languages: string;
  email: string;
  avatarUrl?: string;
};

export default function StudentSettingsPage() {
  const updateProfile = useUpdateProfile();
  const updatePassword = useUpdatePassword();
  const changeEmail = useChangeEmail();
  const updateNotifications = useUpdateNotifications();
  const params = useSearchParams();
  const activeKey = useMemo(() => {
    const key = params.get("tab") || "account";
    return TABS.some((t) => t.key === key) ? key : "account";
  }, [params]);

  // Local UI state placeholders (wiring to Supabase will come next)
  const [profile, setProfile] = useState<StudentProfileState>({
    fullName: "",
    displayName: "",
    timezone: "",
    locale: "",
    languages: "",
    email: "",
  });

  const [notifications, setNotifications] = useState<NotificationsState>({
    lessonReminders: true,
    messages: true,
    receipts: true,
    productUpdates: false,
    digest: "daily",
    quietHours: false,
  });

  const titleByKey: Record<string, string> = {
    account: "Account",
    password: "Password",
    email: "Email",
    payment_methods: "Payment Methods",
    payment_history: "Payment History",
    notifications: "Notifications",
    delete: "Delete Account",
  };

  const [status, setStatus] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [pRes, nRes] = await Promise.all([
          fetch("/api/settings/profile", { credentials: "include" }),
          fetch("/api/settings/notifications", { credentials: "include" }),
        ]);
        if (!cancelled && pRes.ok) {
          const p = await pRes.json();
          setProfile((prev) => ({
            ...prev,
            fullName: p.fullName ?? "",
            displayName: prev.displayName,
            avatarUrl: p.avatarUrl ?? "",
            timezone: p.timezone ?? "",
            locale: p.locale ?? "",
            languages: Array.isArray(p.languages) ? p.languages.join(", ") : p.languages ?? "",
            email: p.email ?? prev.email ?? "",
          }));
        }
        if (!cancelled && nRes.ok) {
          const n = await nRes.json();
          setNotifications({
            lessonReminders: !!n.lesson_reminders,
            messages: !!n.messages,
            receipts: !!n.receipts,
            productUpdates: !!n.product_updates,
            digest: (n.digest as Digest) ?? "daily",
            quietHours: !!n.quiet_hours,
          });
        }
      } catch {
        // noop; keep UI usable
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Submission handlers wired to feature components ---

  async function submitProfile(values: ProfileFormValues) {
    setSavingAccount(true);
    setStatus(null);
    try {
      await updateProfile({
        fullName: values.fullName,
        displayName: values.displayName,
        timezone: values.timezone,
      });
      setStatus("Account saved");
      // reflect changes locally
      setProfile((prev) => ({
        ...prev,
        fullName: values.fullName,
        displayName: values.displayName ?? "",
        timezone: values.timezone ?? "",
      }));
    } catch (err: unknown) {
      setStatus(getErrorMessage(err) || "Could not save account");
    } finally {
      setSavingAccount(false);
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
      setStatus("Notification preferences saved");
      setNotifications((prev) => ({
        ...prev,
        lessonReminders: values.lessonReminders,
        productUpdates: values.marketingEmails,
      }));
    } catch (err: unknown) {
      setStatus(getErrorMessage(err) || "Could not save notifications");
    } finally {
      setSavingNotifications(false);
    }
  }

  async function submitEmail({ currentEmail, newEmail }: EmailChangeValues) {
    setSavingEmail(true);
    setStatus(null);
    try {
      const currentNormalized = currentEmail.trim().toLowerCase();
      const storedNormalized = (profile.email ?? "").trim().toLowerCase();
      if (!storedNormalized || currentNormalized !== storedNormalized) {
        setStatus("Current email does not match our records.");
        setSavingEmail(false);
        return;
      }
      if (currentNormalized === newEmail.trim().toLowerCase()) {
        setStatus("Please enter a different email address.");
        setSavingEmail(false);
        return;
      }

      const r = (await changeEmail({ currentEmail, newEmail })) as { maybeVerificationRequired?: boolean } | void;
      setStatus(
        r?.maybeVerificationRequired
          ? "Email updated. Check your inbox if verification is required."
          : "Email updated."
      );
      setProfile((prev) => ({ ...prev, email: newEmail }));
    } catch (err: unknown) {
      setStatus(getErrorMessage(err) || "Could not update email");
    } finally {
      setSavingEmail(false);
    }
  }

  async function submitPassword(values: PasswordFormValues) {
    setSavingPassword(true);
    setStatus(null);
    try {
      if (values.newPassword !== values.confirmNewPassword) {
        setStatus("Passwords do not match");
        return;
      }
      await updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      });
      setStatus("Password updated");
    } catch (err: unknown) {
      setStatus(getErrorMessage(err) || "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <SettingsShell
      tabs={TABS}
      activeKey={activeKey}
      title={titleByKey[activeKey]}
      description={
        activeKey === "account"
          ? "Update your name, photo, and preferences."
          : activeKey === "password"
          ? "Change your password."
          : activeKey === "email"
          ? "Manage your email."
          : activeKey === "payment_methods"
          ? "Manage saved cards."
          : activeKey === "payment_history"
          ? "View your past payments."
          : activeKey === "notifications"
          ? "Choose which updates you receive and how often."
          : activeKey === "delete"
          ? "Permanently delete your account."
          : undefined
      }
    >
      {status ? <div className="mb-2 text-xs text-slate-600">{status}</div> : null}

      {activeKey === "account" && (
        <ProfileForm
          initialValues={{
            fullName: profile.fullName,
            displayName: profile.displayName,
            timezone: profile.timezone,
          }}
          onSubmit={submitProfile}
          isSubmitting={savingAccount}
        />
      )}

      {activeKey === "password" && (
        <PasswordForm onSubmit={submitPassword} isSubmitting={savingPassword} />
      )}

      {activeKey === "email" && (
        <EmailChangeForm
          onSubmit={submitEmail}
          isSubmitting={savingEmail}
          currentEmail={profile.email}
        />
      )}

      {activeKey === "notifications" && (
        <NotificationsForm
          initialValues={{
            marketingEmails: false, // not tracked yet in page state
            lessonReminders: notifications.lessonReminders,
            // Map other booleans as you expand the shared component
            // For now, we only expose lessonReminders + a generic flag
            // Extend NotificationsForm later with more switches as needed.
          } as NotificationsValues}
          onSubmit={submitNotifications}
          isSubmitting={savingNotifications}
        />
      )}

      {activeKey === "payment_methods" && (
        <div className="space-y-6">
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Stripe integration coming soon.</p>
          </div>
        </div>
      )}

      {activeKey === "payment_history" && (
        <div className="space-y-6">
          <div className="rounded-md border p-4 bg-white">
            <p className="text-sm text-slate-600">Statements and receipts — coming soon.</p>
          </div>
        </div>
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
