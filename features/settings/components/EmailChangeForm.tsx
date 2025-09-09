// features/settings/components/EmailChangeForm.tsx
import * as React from "react";

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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-2xl border shadow-sm bg-white">
      <div>
        <h2 className="text-lg font-semibold">Email</h2>
        <p className="text-sm text-gray-500">Change your sign-in email.</p>
      </div>

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
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 px-4 rounded-md font-medium border bg-black text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Change email"}
        </button>
      </div>
    </form>
  );
}