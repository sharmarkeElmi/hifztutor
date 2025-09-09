import type { ProfileInput } from "@features/settings/lib/schemas";

export default function useUpdateProfile() {
  return async (values: ProfileInput): Promise<void> => {
    // TODO: implement with Supabase (server action / RPC)
    console.log("updateProfile ->", values);
  };
}
