

"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";

// ----- Types -----
export type SettingsTab = {
  key: string;
  label: string;
  href: string; // absolute path like /student/settings or /tutor/settings?tab=profile
  icon?: ReactNode;
  badge?: ReactNode; // optional small badge (e.g., "New")
  disabled?: boolean;
};

export interface SettingsShellProps {
  role: "student" | "tutor";
  tabs: SettingsTab[];
  activeKey: string;
  children: ReactNode;
  /** Optional title shown above the content pane. If omitted, pages can render their own section heading. */
  title?: ReactNode;
  /** Optional description below the title. */
  description?: ReactNode;
}

// small utility
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * SettingsShell
 *
 * A responsive two-column layout used by both Student and Tutor settings pages.
 * - Left rail: sticky navigation (tabs)
 * - Right pane: section content
 * - Mobile: collapses into a horizontal scrollable tab bar
 */
export default function SettingsShell({
  role,
  tabs,
  activeKey,
  children,
  title,
  description,
}: SettingsShellProps) {
  const active = useMemo(() => tabs.find((t) => t.key === activeKey)?.key ?? tabs[0]?.key, [tabs, activeKey]);

  return (
    <section className="relative">
      {/* Page header (role chip) */}
      <div className="mb-5 sm:mb-6 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-600">
          {role === "student" ? "Student" : "Tutor"}
        </span>
        <span className="text-xs text-slate-400">Settings</span>
      </div>

      {/* Mobile horizontal tabs */}
      <div className="sm:hidden mb-4">
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-2">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={cx(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
                  t.disabled && "opacity-50 pointer-events-none",
                  active === t.key
                    ? "border-[#F7D250] bg-[#FFF3C2] text-[#111629]"
                    : "border-[#CDD5E0] bg-white text-slate-700 hover:bg-slate-50"
                )}
                aria-current={active === t.key ? "page" : undefined}
              >
                {t.icon ? <span className="grid place-items-center text-[13px]">{t.icon}</span> : null}
                <span>{t.label}</span>
                {t.badge}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6">
        {/* Left rail nav */}
        <nav className="sm:col-span-4 lg:col-span-3 xl:col-span-3">
          <div className="sticky top-20">
            <ul className="space-y-1">
              {tabs.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className={cx(
                      "group flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                      t.disabled && "opacity-50 pointer-events-none",
                      active === t.key
                        ? "border-[#F7D250] bg-[#FFF3C2] text-[#111629]"
                        : "border-[#CDD5E0] bg-white text-slate-700 hover:bg-slate-50"
                    )}
                    aria-current={active === t.key ? "page" : undefined}
                  >
                    {t.icon ? (
                      <span
                        className={cx(
                          "grid h-8 w-8 place-items-center rounded-md border",
                          active === t.key ? "border-[#F7D250]" : "border-[#CDD5E0]"
                        )}
                        style={active === t.key ? { background: "#FFF3C2", color: "#111629" } : {}}
                        aria-hidden
                      >
                        {t.icon}
                      </span>
                    ) : null}
                    <span className="font-medium">{t.label}</span>
                    {t.badge ? <span className="ml-auto">{t.badge}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content pane */}
        <div className="sm:col-span-8 lg:col-span-9 xl:col-span-9">
          <div className="relative overflow-hidden rounded-xl border bg-white p-5 sm:p-6 shadow-sm">
            {title ? (
              <div className="mb-3">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
                {description ? (
                  <p className="text-slate-600 mt-1 text-sm">{description}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-6">{children}</div>

            {/* Accent blob */}
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-10"
              style={{ background: "#D3F501" }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}