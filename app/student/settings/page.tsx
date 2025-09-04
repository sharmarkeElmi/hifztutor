"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsShell, { type SettingsTab } from "../../components/settings/SettingsShell";

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

type NotificationBooleanKey = Exclude<keyof NotificationsState, "digest" | "quietHours">;

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            {desc ? <p className="mt-1 text-sm text-slate-600">{desc}</p> : null}
            <div className="mt-3 h-px w-full bg-slate-200" />
        </div>
    );
}

type StudentProfileState = {
    fullName: string;
    displayName: string;
    timezone: string;
    locale: string;
    languages: string;
    avatarUrl?: string;
};

function getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export default function StudentSettingsPage() {
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
    });

    const [account, setAccount] = useState({
        email: "",
        phone: "",
    });

    const [notifications, setNotifications] = useState<NotificationsState>({
        lessonReminders: true,
        messages: true,
        receipts: true,
        productUpdates: false,
        digest: "daily" as Digest,
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

    const EMAIL_ROWS: { key: NotificationBooleanKey; label: string }[] = [
        { key: "lessonReminders", label: "Lesson reminders" },
        { key: "messages", label: "Messages" },
        { key: "receipts", label: "Payment receipts" },
        { key: "productUpdates", label: "Product updates" },
    ];

    const [status, setStatus] = useState<string | null>(null);
    const [savingAccount, setSavingAccount] = useState(false);
    const [savingNotifications, setSavingNotifications] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });


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
                        displayName: prev.displayName, // unchanged here (optional)
                        avatarUrl: p.avatarUrl ?? "",
                        timezone: p.timezone ?? "",
                        locale: p.locale ?? "",
                        languages: Array.isArray(p.languages) ? p.languages.join(", ") : (p.languages ?? ""),
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

    async function handleSaveAccount() {
        setSavingAccount(true);
        setStatus(null);
        try {
            const res = await fetch("/api/settings/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    fullName: profile.fullName,
                    avatarUrl: profile.avatarUrl ?? null,
                    timezone: profile.timezone,
                    locale: profile.locale,
                    languages: profile.languages, // CSV handled by API normalizer
                }),
            });
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) throw new Error(j.error || "Failed");
            setStatus("Account saved");
        } catch (err: unknown) {
            setStatus(getErrorMessage(err) || "Could not save account");
        } finally {
            setSavingAccount(false);
        }
    }

    async function handleSaveNotifications() {
        setSavingNotifications(true);
        setStatus(null);
        try {
            const payload = {
                lesson_reminders: notifications.lessonReminders,
                messages: notifications.messages,
                receipts: notifications.receipts,
                product_updates: notifications.productUpdates,
                digest: notifications.digest,
                quiet_hours: notifications.quietHours,
            };
            const res = await fetch("/api/settings/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) throw new Error(j.error || "Failed");
            setStatus("Notification preferences saved");
        } catch (err: unknown) {
            setStatus(getErrorMessage(err) || "Could not save notifications");
        } finally {
            setSavingNotifications(false);
        }
    }

    async function handleUpdateEmail() {
        setSavingEmail(true);
        setStatus(null);
        try {
            const res = await fetch("/api/settings/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: account.email }),
            });
            const j = (await res.json().catch(() => ({}))) as { error?: string; maybeVerificationRequired?: boolean };
            if (!res.ok) throw new Error(j.error || (res.status === 401 ? "Not signed in" : "Failed"));
            setStatus(
                j.maybeVerificationRequired
                    ? "Email updated. Check your inbox if verification is required."
                    : "Email updated."
            );
        } catch (err: unknown) {
            setStatus(getErrorMessage(err) || "Could not update email");
        } finally {
            setSavingEmail(false);
        }
    }

    async function handleUpdatePassword() {
        setSavingPassword(true);
        setStatus(null);
        try {
            if (passwords.new !== passwords.confirm) {
                setStatus("Passwords do not match");
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
            setStatus("Password updated");
            setPasswords({ current: "", new: "", confirm: "" });
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
                            ? "Manage your email and recovery phone."
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
            {status ? (
                <div className="mb-2 text-xs text-slate-600">{status}</div>
            ) : null}

            {activeKey === "account" && (
                <div className="space-y-6">
                    <SectionHeader title="Basic info" desc="Your name and how it appears across HifzTutor." />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-medium">Full name</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={profile.fullName}
                                onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">Display name (optional)</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={profile.displayName}
                                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium">Avatar URL (optional)</span>
                        <input
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                            value={profile.avatarUrl ?? ""}
                            onChange={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                            <span className="text-sm font-medium">Time zone</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={profile.timezone}
                                onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">Locale</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={profile.locale}
                                onChange={(e) => setProfile((p) => ({ ...p, locale: e.target.value }))}
                            />
                        </label>
                        <label className="block sm:col-span-1">
                            <span className="text-sm font-medium">Languages</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={profile.languages}
                                onChange={(e) => setProfile((p) => ({ ...p, languages: e.target.value }))}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveAccount}
                            disabled={savingAccount}
                            className="rounded-md px-4 py-2 text-sm text-[#111629] disabled:opacity-60"
                            style={{ backgroundColor: "#F7D250" }}
                        >
                            {savingAccount ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}

            {activeKey === "password" && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                            <span className="text-sm font-medium">Current password</span>
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={passwords.current}
                                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">New password</span>
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={passwords.new}
                                onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">Confirm password</span>
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                            />
                        </label>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleUpdatePassword}
                            disabled={savingPassword}
                            className="rounded-md px-4 py-2 text-sm text-[#111629] disabled:opacity-60"
                            style={{ backgroundColor: "#F7D250" }}
                        >
                            {savingPassword ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}

            {activeKey === "email" && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-medium">Email</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={account.email}
                                onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                            />
                            <p className="mt-1 text-xs text-slate-500">We’ll show verification status here.</p>
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">Phone (optional)</span>
                            <input
                                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                value={account.phone}
                                onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
                            />
                        </label>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleUpdateEmail}
                            disabled={savingEmail}
                            className="rounded-md px-4 py-2 text-sm text-[#111629] disabled:opacity-60"
                            style={{ backgroundColor: "#F7D250" }}
                        >
                            {savingEmail ? "Saving…" : "Save Changes"}
                        </button>
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

                    <SectionHeader title="Surveys and interviews" desc="Earn rewards by offering feedback on your learning experience." />
                    <div className="rounded-md border p-4 bg-white">
                        <p className="text-sm text-slate-600">Occasionally we&apos;ll invite you to share feedback in exchange for rewards.</p>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveNotifications}
                            disabled={savingNotifications}
                            className="rounded-md px-4 py-2 text-sm text-[#111629] disabled:opacity-60"
                            style={{ backgroundColor: "#F7D250" }}
                        >
                            {savingNotifications ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
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
                        <button className="rounded-md px-4 py-2 text-sm text-white" style={{ backgroundColor: "#e11d48" }}>
                            Delete my account
                        </button>
                    </div>
                </div>
            )}
        </SettingsShell>
    );
}
