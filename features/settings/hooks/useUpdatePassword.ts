// features/settings/hooks/useUpdatePassword.ts
import type { PasswordInput } from "@features/settings/lib/schemas";

export default function useUpdatePassword() {
  return async (values: PasswordInput): Promise<void> => {
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ newPassword: values.newPassword }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(j.error || "Failed to update password");
  };
}
