"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { detectLocalTimezone, getAllTimezones } from "@features/settings/lib/timezones";
import { cn } from "@/lib/utils";
import { formHelp, formInput, formLabel } from "@/components/forms/classes";

type TimezoneSelectProps = {
  value?: string;
  onChange: (next: string) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  labelClassName?: string;
};

export default function TimezoneSelect({
  value,
  onChange,
  label = "Timezone",
  helperText,
  disabled = false,
  id = "timezone",
  name = "timezone",
  className,
  labelClassName,
}: TimezoneSelectProps) {
  const options = useMemo(() => {
    const zones = getAllTimezones();
    return zones;
  }, []);
  const localTimezone = useMemo(() => detectLocalTimezone(), []);
  const formattedOptions = useMemo(() => {
    return options.map((tz) => ({
      value: tz,
      label: formatTimezoneLabel(tz),
    }));
  }, [options]);
  const localTimezoneLabel = useMemo(() => formatTimezoneLabel(localTimezone), [localTimezone]);

  const normalizedOptions = useMemo(() => {
    const deviceOption = {
      value: localTimezone,
      label: `${localTimezoneLabel} (device)`,
      highlight: true,
    };
    const others = formattedOptions
      .filter((opt) => opt.value !== localTimezone)
      .map((opt) => ({ ...opt, highlight: false }));
    return [deviceOption, ...others];
  }, [formattedOptions, localTimezone, localTimezoneLabel]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [listMaxHeight, setListMaxHeight] = useState<number | null>(null);
  const [isPortalReady, setIsPortalReady] = useState(false);

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      setListMaxHeight(null);
      return;
    }

    function updatePosition() {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 16;
      const width = rect.width;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - viewportPadding - width);
      const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
      const spaceBelow = Math.max(window.innerHeight - rect.bottom - viewportPadding - gap, 0);
      const spaceAbove = Math.max(rect.top - viewportPadding - gap, 0);

      let top: number;
      let maxHeight: number;
      if (spaceBelow >= spaceAbove) {
        top = rect.bottom + gap;
        maxHeight = spaceBelow;
      } else {
        maxHeight = spaceAbove;
        top = Math.max(viewportPadding, rect.top - gap - maxHeight);
      }

      setPosition({ top, left, width, maxHeight });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !position) {
      setListMaxHeight(null);
      return;
    }

    const searchHeight = searchRef.current?.getBoundingClientRect().height ?? 0;
    const availableForList = position.maxHeight - searchHeight;
    setListMaxHeight(availableForList > 0 ? availableForList : null);
  }, [open, position]);

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) => opt.label.toLowerCase().includes(term) || opt.value.toLowerCase().includes(term)
    );
  }, [normalizedOptions, query]);

  const selectedOption =
    normalizedOptions.find((opt) => opt.value === value) ??
    (value ? { value, label: formatTimezoneLabel(value), highlight: false } : null);

  const buttonLabel = selectedOption?.label ?? "Select a timezone…";

  const handleSelect = (tz: string) => {
    onChange(tz);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={cn("relative space-y-1", className)}>
      <label htmlFor={id} className={cn(formLabel, labelClassName)}>
        {label}
      </label>

      <button
        ref={buttonRef}
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={cn(
          formInput,
          "flex w-full min-w-0 items-center justify-between gap-3 bg-white text-left font-medium transition-colors text-[17px] py-3.5 sm:text-[15px] sm:py-2.5",
          disabled
            ? "cursor-not-allowed bg-slate-50 text-slate-400 opacity-70"
            : "cursor-pointer text-[#111629]"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
      >
        <span
          className={cn(
            "flex-1 truncate min-w-0 text-[17px] leading-[1.3] sm:text-[15px] sm:leading-normal",
            selectedOption ? "text-[#111629]" : "text-slate-400"
          )}
          title={buttonLabel}
        >
          {buttonLabel}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7L10 12L15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {helperText ? <p className={formHelp}>{helperText}</p> : null}

      {open && isPortalReady && position
        ? createPortal(
            <div
              id={`${id}-popover`}
              ref={popoverRef}
              className="z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              <div ref={searchRef} className="border-b border-slate-100 p-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search timezone…"
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#AECBFA]/70"
                />
              </div>
              <ul
                id={`${id}-listbox`}
                role="listbox"
                aria-activedescendant={selectedOption ? `${id}-${selectedOption.value}` : undefined}
                className="overflow-y-auto py-1"
                style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
              >
                {filteredOptions.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-slate-400">No timezones match your search.</li>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <li key={opt.value} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition ${
                            isSelected ? "bg-[#EAF2FF] font-semibold text-[#1A73E8]" : "hover:bg-slate-50"
                          }`}
                          id={`${id}-${opt.value}`}
                        >
                          <span className="truncate text-slate-700">{opt.label}</span>
                          {opt.highlight ? (
                            <span className="rounded-full bg-[#E8F0FE] px-2 py-0.5 text-[11px] font-semibold text-[#1A73E8]">
                              Device
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function formatTimezoneLabel(timeZone: string): string {
  const readableName = timeZone.replace(/_/g, " ");
  const offset = getTimezoneOffsetLabel(timeZone);
  return `${readableName} ${offset}`;
}

function getTimezoneOffsetLabel(timeZone: string): string {
  const reference = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "longOffset",
    }).formatToParts(reference);
    const tzName = parts.find((part) => part.type === "timeZoneName")?.value;
    if (tzName) {
      const cleaned = tzName.replace("GMT", "GMT ").replace("UTC", "GMT ");
      return cleaned.trim();
    }
  } catch {
    // ignore and fallback
  }

  const utcDate = new Date(
    reference.toLocaleString("en-US", {
      timeZone: "UTC",
    })
  );
  const tzDate = new Date(
    reference.toLocaleString("en-US", {
      timeZone,
    })
  );
  const diffMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const minutes = Math.abs(diffMinutes);
  const hoursPart = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const minutesPart = (minutes % 60).toString().padStart(2, "0");
  return `GMT ${sign}${hoursPart}:${minutesPart}`;
}
