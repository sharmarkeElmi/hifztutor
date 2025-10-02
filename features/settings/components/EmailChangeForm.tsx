// features/settings/components/EmailChangeForm.tsx
import * as React from "react";
import { Button } from "@components/ui/button";
import { formStack, formLabel, formInput, formHelp } from "@/components/forms/classes";

export type EmailChangeValues = {
  currentEmail: string;
  newEmail: string;
};

type EmailChangeFormProps = {
  onSubmit: (values: EmailChangeValues) => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function EmailChangeForm({ onSubmit, isSubmitting = false }: EmailChangeFormProps) {
  const [currentEmail, setCurrentEmail] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ currentEmail, newEmail });
  }

  return (
    <form onSubmit={handleSubmit} className={formStack}>
      <div className="space-y-1">
        <label htmlFor="current-email" className={formLabel}>
          Current email address
        </label>
        <input
          id="current-email"
          type="email"
          aria-label="Current email"
          className={formInput}
          value={currentEmail}
          onChange={(e) => setCurrentEmail(e.target.value)}
          required
          placeholder="Enter the email on your account"
        />
        <p className={formHelp}>We use this to verify the change.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="new-email" className={formLabel}>
          New email address
        </label>
        <input
          id="new-email"
          type="email"
          aria-label="New email"
          className={formInput}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} variant="formPrimary" className="px-6">
          {isSubmitting ? "Saving…" : "Change email"}
        </Button>
      </div>
    </form>
  );
}
