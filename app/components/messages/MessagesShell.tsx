"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { cx } from "class-variance-authority";

type FilterKey = "all" | "unread" | "archived";

export default function MessagesShell({
  activeKey,
  children,
}: {
  activeKey: FilterKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseParams = new URLSearchParams(searchParams?.toString() || "");

  const tabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "archived", label: "Archived" },
  ];

  const hrefFor = (key: FilterKey) => {
    const p = new URLSearchParams(baseParams.toString());
    if (key === "all") p.delete("filter");
    else p.set("filter", key);
    return `${pathname}?${p.toString()}`.replace(/\?$/, "");
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Mobile sub-nav */}
      <div className="block sm:hidden bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scrollbar-hide border-b border-slate-200">
        <div
          className="overflow-x-auto scrollbar-hide h-12 bg-white"
          role="tablist"
          aria-label="Messages tabs"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex h-full items-center gap-4">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={hrefFor(t.key)}
                className={cx(
                  "relative inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                  activeKey === t.key ? "text-[#111629] font-semibold" : "text-slate-700 hover:bg-slate-50 font-medium"
                )}
                role="tab"
                aria-selected={activeKey === t.key}
                aria-current={activeKey === t.key ? "page" : undefined}
              >
                <span className="leading-none">{t.label}</span>
                {activeKey === t.key ? (
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

      {/* Desktop sub-nav */}
      <div
        className="hidden sm:block border-b border-slate-200 bg-white"
        style={{ width: "var(--inbox-sidebar-w, 420px)" }}
      >
        <ul className="flex items-center gap-3 md:gap-4 h-12" role="tablist" aria-label="Messages tabs">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={hrefFor(t.key)}
                className={cx(
                  "relative inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                  activeKey === t.key ? "text-[#111629] font-semibold" : "text-slate-700 hover:bg-slate-50 font-medium"
                )}
                role="tab"
                aria-selected={activeKey === t.key}
                aria-current={activeKey === t.key ? "page" : undefined}
              >
                <span className="leading-none">{t.label}</span>
                {activeKey === t.key ? (
                  <span
                    className="pointer-events-none absolute -bottom-2 left-2 right-2 h-[3px] rounded-full"
                    style={{ backgroundColor: "#D3F501" }}
                    aria-hidden
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Content (aligned to sub‑nav; no top gap) */}
      <div className="pt-0 pb-0 overflow-hidden">{children}</div>
    </section>
  );
}