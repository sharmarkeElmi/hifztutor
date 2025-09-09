// features/settings/components/NotificationsForm.tsx
import * as React from "react";

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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-2xl border shadow-sm bg-white">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-gray-500">Control email reminders and updates.</p>
      </div>

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
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md px-4 py-2 text-base font-medium text-black bg-[#D3F501] border-2 !border-black hover:shadow-md disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489] transition"
        >
          {isSubmitting ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
