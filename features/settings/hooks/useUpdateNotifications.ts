// features/settings/hooks/useUpdateNotifications.ts
export default function useUpdateNotifications() {
  return async (values: import("../lib/schemas").NotificationsInput) => {
    console.log("updateNotifications ->", values);
  };
}