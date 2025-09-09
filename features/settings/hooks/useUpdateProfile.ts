import type { ProfileInput } from "@features/settings/lib/schemas";

export default function useUpdateProfile() {
  return async (values: ProfileInput): Promise<void> => {
    const body = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined)
    );

    const res = await fetch("/api/settings/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(j.error || "Failed to update profile");
  };
}
