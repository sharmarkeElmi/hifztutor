// features/settings/components/PasswordForm.tsx
import * as React from "react";
import { Button } from "@components/ui/button";
import { formStack, formLabel, formInput, formHelp } from "@/components/forms/classes";

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
  const [show, setShow] = React.useState({ current: false, next: false, confirm: false });

  function handleChange<K extends keyof PasswordFormValues>(key: K, v: PasswordFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.newPassword !== values.confirmNewPassword) {
      alert("New passwords do not match");
      return;
    }
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className={formStack}>
      <PasswordField
        id="current-password"
        label="Current password"
        value={values.currentPassword}
        onChange={(value) => handleChange("currentPassword", value)}
        show={show.current}
        onToggleShow={() => setShow((prev) => ({ ...prev, current: !prev.current }))}
      />

      <PasswordField
        id="new-password"
        label="New password"
        value={values.newPassword}
        onChange={(value) => handleChange("newPassword", value)}
        show={show.next}
        onToggleShow={() => setShow((prev) => ({ ...prev, next: !prev.next }))}
        hint="At least 8 characters."
      />

      <PasswordField
        id="confirm-new-password"
        label="Confirm new password"
        value={values.confirmNewPassword}
        onChange={(value) => handleChange("confirmNewPassword", value)}
        show={show.confirm}
        onToggleShow={() => setShow((prev) => ({ ...prev, confirm: !prev.confirm }))}
        statusMessage={
          values.confirmNewPassword
            ? values.newPassword === values.confirmNewPassword
              ? "Passwords match"
              : "Passwords do not match"
            : null
        }
        statusTone={values.newPassword === values.confirmNewPassword}
      />

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} variant="formPrimary" className="px-6">
          {isSubmitting ? "Saving…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  hint?: string;
  statusMessage?: string | null;
  statusTone?: boolean;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  hint,
  statusMessage,
  statusTone,
}: PasswordFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={`${formLabel} flex-1`}>
          {label}
        </label>
        <button
          type="button"
          className="text-xs font-semibold text-[#111629] underline"
          onClick={onToggleShow}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <input
        id={id}
        type={show ? "text" : "password"}
        className={formInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      {hint ? <p className={formHelp}>{hint}</p> : null}
      {statusMessage ? (
        <p className="text-sm" role="status" aria-live="polite">
          <span className={statusTone ? "text-[#10B981]" : "text-red-600"}>{statusMessage}</span>
        </p>
      ) : null}
    </div>
  );
}
