// features/settings/hooks/useUpdatePassword.ts
import type { PasswordInput } from "@features/settings/lib/schemas";

export default function useUpdatePassword() {
  return async (values: PasswordInput): Promise<void> => {
    // TODO: wire to Supabase/server action
    console.log("updatePassword ->", values);
  };
}
