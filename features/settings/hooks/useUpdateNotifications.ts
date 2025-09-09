// features/settings/hooks/useUpdateNotifications.ts
import type { NotificationsInput } from "@features/settings/lib/schemas";

export default function useUpdateNotifications() {
  return async (values: NotificationsInput): Promise<void> => {
    const payload = {
      lesson_reminders: values.lessonReminders,
      product_updates: values.marketingEmails,
    } as const;

    const res = await fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(j.error || "Failed to update notifications");
  };
}
