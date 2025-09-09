// features/settings/hooks/useChangeEmail.ts
export default function useChangeEmail() {
  return async (values: import("../lib/schemas").EmailChangeInput) => {
    console.log("changeEmail ->", values);
  };
}