// features/settings/components/ProfileForm.tsx
// Purpose: Reusable profile form used by both student & tutor settings pages.
// Why: Keeps route pages thin and centralizes UI/validation in the feature folder.
// Notes: Wire real submit logic later via the onSubmit prop (and hooks in features/settings/hooks).

import * as React from "react";

export type ProfileFormValues = {
  fullName: string;
  displayName?: string;
  country?: string;
  timezone?: string;
};

type ProfileFormProps = {
  initialValues?: ProfileFormValues;
  onSubmit: (values: ProfileFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  // Allow extra content (e.g., save status) to be injected from pages
  footerSlot?: React.ReactNode;
};

export default function ProfileForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
  footerSlot,
}: ProfileFormProps) {
  const [values, setValues] = React.useState<ProfileFormValues>({
    fullName: initialValues?.fullName ?? "",
    displayName: initialValues?.displayName ?? "",
    country: initialValues?.country ?? "",
    timezone: initialValues?.timezone ?? "",
  });

  function handleChange<K extends keyof ProfileFormValues>(key: K, v: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-2xl border shadow-sm bg-white">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-gray-500">Update your basic information.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Full name</span>
          <input
            aria-label="Full name"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Display name</span>
          <input
            aria-label="Display name"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.displayName ?? ""}
            onChange={(e) => handleChange("displayName", e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Country</span>
          <input
            aria-label="Country"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.country ?? ""}
            onChange={(e) => handleChange("country", e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Time zone</span>
          <input
            aria-label="Time zone"
            className="h-10 rounded-md border px-3 outline-none focus:ring-2 focus:ring-[#D3F501]"
            value={values.timezone ?? ""}
            onChange={(e) => handleChange("timezone", e.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        {footerSlot ?? <div />}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 px-4 rounded-md font-medium border bg-black text-white hover:opacity-90 disabled:opacity-60"
          style={{ outlineColor: "#D3F501" }}
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}