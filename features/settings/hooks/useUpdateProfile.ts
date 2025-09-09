export default function useUpdateProfile() {
  return async (values: import("../lib/schemas").ProfileInput) => {
    // TODO: implement with Supabase (server action / RPC)
    console.log("updateProfile ->", values);
  };
}