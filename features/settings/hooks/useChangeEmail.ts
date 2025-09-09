// features/settings/hooks/useChangeEmail.ts
import type { EmailChangeInput } from "@features/settings/lib/schemas";

export default function useChangeEmail() {
  return async (values: EmailChangeInput): Promise<void> => {
    // TODO: wire to Supabase/server action
    console.log("changeEmail ->", values);
  };
}
