// features/settings/hooks/useUpdateNotifications.ts
export default function useUpdateNotifications() {
  return async (values: import("../lib/schemas").NotificationsInput) => {
    // TODO: wire to Supabase/server action
    console.log("updateNotifications ->", values);
  };
}
