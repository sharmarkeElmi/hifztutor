// features/settings/components/PasswordForm.tsx
import * as React from "react";
import { Button } from "@components/ui/button";

export type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

type PasswordFormProps = {
  onSubmit: (values: PasswordFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function PasswordForm({ onSubmit, isSubmitting = false }: PasswordFormProps) {
  const [values, setValues] = React.useState<PasswordFormValues>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  function handleChange<K extends keyof PasswordFormValues>(key: K, v: PasswordFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Very basic client check—real validation lives in zod in features/settings/lib (later)
    if (values.newPassword !== values.confirmNewPassword) {
      alert("New passwords do not match");
      return;
    }
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Current password</span>
          <input
            type="password"
            aria-label="Current password"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.currentPassword}
            onChange={(e) => handleChange("currentPassword", e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">New password</span>
          <input
            type="password"
            aria-label="New password"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.newPassword}
            onChange={(e) => handleChange("newPassword", e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium">Confirm new password</span>
          <input
            type="password"
            aria-label="Confirm new password"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.confirmNewPassword}
            onChange={(e) => handleChange("confirmNewPassword", e.target.value)}
            required
          />
        </label>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" variant="default" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
