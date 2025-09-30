// features/settings/hooks/useChangeEmail.ts
import type { EmailChangeInput } from "@features/settings/lib/schemas";

export default function useChangeEmail() {
  return async (values: EmailChangeInput): Promise<{ maybeVerificationRequired?: boolean } | void> => {
    const res = await fetch("/api/settings/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentEmail: values.currentEmail, newEmail: values.newEmail }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; maybeVerificationRequired?: boolean };
    if (!res.ok) throw new Error(j.error || "Failed to update email");
    return { maybeVerificationRequired: !!j.maybeVerificationRequired };
  };
}
