// features/settings/components/NotificationsForm.tsx
import * as React from "react";
import { Button } from "@components/ui/button";

export type NotificationsValues = {
  marketingEmails: boolean;
  lessonReminders: boolean;
};

type NotificationsFormProps = {
  initialValues?: NotificationsValues;
  onSubmit: (values: NotificationsValues) => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function NotificationsForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
}: NotificationsFormProps) {
  const [values, setValues] = React.useState<NotificationsValues>({
    marketingEmails: initialValues?.marketingEmails ?? false,
    lessonReminders: initialValues?.lessonReminders ?? true,
  });

  function toggle<K extends keyof NotificationsValues>(key: K) {
    setValues((v) => ({ ...v, [key]: !v[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.lessonReminders}
            onChange={() => toggle("lessonReminders")}
            className="h-4 w-4"
          />
            <span className="text-sm">Lesson reminders</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.marketingEmails}
            onChange={() => toggle("marketingEmails")}
            className="h-4 w-4"
          />
            <span className="text-sm">Product updates & tips</span>
        </label>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" variant="default" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
