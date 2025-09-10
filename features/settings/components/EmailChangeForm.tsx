// features/settings/components/EmailChangeForm.tsx
import * as React from "react";
import { Button } from "@components/ui/button";

export type EmailChangeValues = {
  newEmail: string;
};

type EmailChangeFormProps = {
  onSubmit: (values: EmailChangeValues) => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function EmailChangeForm({ onSubmit, isSubmitting = false }: EmailChangeFormProps) {
  const [email, setEmail] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ newEmail: email });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">New email</span>
        <input
          type="email"
          aria-label="New email"
          className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" variant="default" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Change email"}
        </Button>
      </div>
    </form>
  );
}
