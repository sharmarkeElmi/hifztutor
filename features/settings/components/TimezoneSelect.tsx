"use client";

import { useMemo } from "react";
import { Button } from "@components/ui/button";
import { detectLocalTimezone, getAllTimezones } from "@features/settings/lib/timezones";

type TimezoneSelectProps = {
  value?: string;
  onChange: (next: string) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  showDetectButton?: boolean;
};

export default function TimezoneSelect({
  value,
  onChange,
  label = "Time zone",
  helperText,
  disabled = false,
  id = "timezone",
  name = "timezone",
  showDetectButton = true,
}: TimezoneSelectProps) {
  const options = useMemo(() => {
    const zones = getAllTimezones();
    return zones;
  }, []);
  const localTimezone = useMemo(() => detectLocalTimezone(), []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {showDetectButton ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange(localTimezone)}
            disabled={disabled || value === localTimezone}
          >
            Use my timezone
          </Button>
        ) : null}
      </div>
      {helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
      <select
        id={id}
        name={name}
        className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#D3F501] focus:ring-2 focus:ring-[#D3F501]"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Select a timezone…</option>
        <option value={localTimezone}>{localTimezone} (device)</option>
        <optgroup label="All timezones">
          {options
            .filter((tz) => tz !== localTimezone)
            .map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
