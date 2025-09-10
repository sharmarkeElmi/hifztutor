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
  tabs,
  activeKey,
  children,
  title,
  description,
}: SettingsShellProps) {
  const active = useMemo(() => tabs.find((t) => t.key === activeKey)?.key ?? tabs[0]?.key, [tabs, activeKey]);

  return (
      <section className="relative w-full px-0 sm:px-6 lg:px-8">

      {/* Mobile horizontal tabs (true full-bleed) */}
      <div className="block sm:hidden relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-white border-b border-t-0 border-slate-200 -mt-[6px]">
        <div
          className="overflow-x-auto scrollbar-hide h-12 bg-white px-4 sm:px-6 lg:px-8"
          role="tablist"
          aria-label="Settings tabs"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex h-full items-center gap-4">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={cx(
                  "relative inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[16px] sm:text-[17px] whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] focus-visible:ring-offset-2",
                  t.disabled && "opacity-50 pointer-events-none",
                  active === t.key ? "text-[#111629] font-semibold" : "text-slate-700 hover:bg-slate-50"
                )}
                aria-current={active === t.key ? "page" : undefined}
                role="tab"
                aria-selected={active === t.key}
              >
                {t.icon ? <span className="grid place-items-center text-[13px]">{t.icon}</span> : null}
                <span className="leading-none">{t.label}</span>
                {t.badge}
                {active === t.key ? (
                  <span
                    className="pointer-events-none absolute -bottom-1 left-2 right-2 h-[3px] rounded-full"
                    style={{ backgroundColor: "#D3F501" }}
                    aria-hidden
                  />
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="sm:flex sm:items-start sm:gap-8">
        {/* Left rail nav */}
        <nav aria-label="Settings sections" className="hidden sm:block sm:w-56 shrink-0">
          <div className="sticky top-20">
            <ul className="space-y-2.5">
              {tabs.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className={cx(
                      "group flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-[16px] sm:text-[17px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] focus-visible:ring-offset-2",
                      t.disabled && "opacity-50 pointer-events-none",
                      active === t.key ? "text-[#111629] font-semibold" : "text-slate-700 hover:bg-slate-50"
                    )}
                    aria-current={active === t.key ? "page" : undefined}
                  >
                    {active === t.key ? (
                      <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: "#D3F501" }} aria-hidden />
                    ) : (
                      <span className="h-6 w-1.5" aria-hidden />
                    )}
                    {t.icon ? (
                      <span
                        className={cx(
                          "grid h-9 w-9 place-items-center rounded-md border transition",
                          active === t.key ? "border-[#D3F501]" : "border-[#CDD5E0]"
                        )}
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
        <div className="sm:flex-1">
          <div className="relative overflow-hidden rounded-2xl border bg-white p-6 sm:p-8 lg:p-10 shadow-md transition-shadow hover:shadow-lg max-w-[720px] mx-auto mt-3 sm:mt-4">
            {title ? (
              <div className="mb-4 border-b pb-3">
                <h1 className="text-[22px] sm:text-2xl lg:text-[30px] font-bold tracking-tight leading-snug">{title}</h1>
                {description ? (
                  <p className="text-slate-600 mt-2 text-[16px] leading-relaxed">{description}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="settings-pane space-y-10">{children}</div>
            </div>

            {/* Accent blob */}
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-20 w-20 rounded-full opacity-5"
              style={{ background: "#D3F501" }}
              aria-hidden
            />
          </div>
        </div>
      </div>
      <style jsx global>{`
        /* Hide scrollbars anywhere inside .scrollbar-hide */
        .scrollbar-hide::-webkit-scrollbar { display: none; height: 0; width: 0; }
        .scrollbar-hide *::-webkit-scrollbar { display: none; height: 0; width: 0; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .settings-pane button {
          width: 100%;
          border-radius: 0.5rem;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: all 0.2s;
        }
        .settings-pane button:hover:not(:disabled) {
          filter: brightness(0.95);
        }
        .settings-pane button:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>
      </section>
  );
}