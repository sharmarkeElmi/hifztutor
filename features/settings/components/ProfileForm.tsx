// features/settings/components/ProfileForm.tsx
// Purpose: Reusable profile form used by both student & tutor settings pages.
// Why: Keeps route pages thin and centralizes UI/validation in the feature folder.
// Notes: Wire real submit logic later via the onSubmit prop (and hooks in features/settings/hooks).

import * as React from "react";
import { Button } from "@components/ui/button";
import { cn } from "@/lib/utils";
import { formInput, formLabel, formStack } from "@/components/forms/classes";
import TimezoneSelect from "@features/settings/components/TimezoneSelect";
import { detectLocalTimezone } from "@features/settings/lib/timezones";

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
  showDisplayName?: boolean;
  showCountry?: boolean;
  showTimezone?: boolean;
};

export default function ProfileForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
  footerSlot,
  showDisplayName = true,
  showCountry = true,
  showTimezone = true,
}: ProfileFormProps) {
  const [values, setValues] = React.useState<ProfileFormValues>({
    fullName: initialValues?.fullName ?? "",
    displayName: initialValues?.displayName ?? "",
    country: initialValues?.country ?? "",
    timezone: initialValues?.timezone ?? "",
  });
  const deviceTimezone = React.useMemo(() => detectLocalTimezone(), []);

  React.useEffect(() => {
    setValues({
      fullName: initialValues?.fullName ?? "",
      displayName: initialValues?.displayName ?? "",
      country: initialValues?.country ?? "",
      timezone: initialValues?.timezone ?? "",
    });
  }, [initialValues?.country, initialValues?.displayName, initialValues?.fullName, initialValues?.timezone]);

  React.useEffect(() => {
    setValues((prev) => {
      if (prev.timezone && prev.timezone.length > 0) return prev;
      return { ...prev, timezone: deviceTimezone };
    });
  }, [deviceTimezone]);

  function handleChange<K extends keyof ProfileFormValues>(key: K, v: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className={cn(formStack, "flex h-full flex-col")}>
      <div className="grid grid-cols-1 flex-1 gap-5 md:grid-cols-2 md:items-start">
        <div className="space-y-1">
          <label htmlFor="full-name" className={formLabel}>
            Full name
          </label>
          <input
            id="full-name"
            className={cn(formInput, "text-[17px] py-3.5 sm:text-base sm:py-2.5")}
            value={values.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        {showDisplayName ? (
          <div className="space-y-1">
            <label htmlFor="display-name" className={formLabel}>
              Display name
            </label>
            <input
              id="display-name"
              className={cn(formInput, "text-[17px] py-3.5 sm:text-base sm:py-2.5")}
              value={values.displayName ?? ""}
              onChange={(e) => handleChange("displayName", e.target.value)}
              autoComplete="nickname"
            />
          </div>
        ) : null}

        {showCountry ? (
          <div className="space-y-1">
            <label htmlFor="country" className={formLabel}>
              Country
            </label>
            <input
              id="country"
              className={cn(formInput, "text-[17px] py-3.5 sm:text-base sm:py-2.5")}
              value={values.country ?? ""}
              onChange={(e) => handleChange("country", e.target.value)}
              autoComplete="country-name"
            />
          </div>
        ) : null}

        {showTimezone ? (
          <TimezoneSelect
            value={values.timezone ?? deviceTimezone}
            onChange={(tz) => handleChange("timezone", tz)}
            helperText="Used to show schedules in your local time."
          />
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-2">
        {footerSlot ? (
          <div className="text-sm text-slate-500 sm:max-w-sm">{footerSlot}</div>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Button
          type="submit"
          variant="formPrimary"
          disabled={isSubmitting}
          className="w-full px-6 sm:flex-1"
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
