// app/@shells/DashboardShell.tsx
"use client";

/**
 * DashboardShell (MVP)
 * ------------------------------------------------------------
 * - Sticky left sidebar with brand + navigation
 * - Role-aware links (student/tutor)
 * - Unread badge for Messages (live via Postgres changes)
 * - Minimal dependencies, Tailwind-only styling
 *
 * Usage:
 *   <Shell role="student"> ...page content... </Shell>
 *   <Shell role="tutor"   activeKey="availability"> ... </Shell>
 */

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// 🔧 Include full set for student & tutor menus
type NavKey =
  | "overview"
  | "messages"
  | "lessons"
  | "saved"
  | "find_tutors"
  | "availability"
  | "classroom"
  | "insights"
  | "settings";

// Local sidebar item type (we keep everything in this file)
type SidebarItem = { key: NavKey | "logout"; label: string; href: string; badge?: ReactNode; exact?: boolean };

type Props = {
  role: "student" | "tutor";
  /** Optional explicit active key (for deep routes). */
  activeKey?: NavKey;
  /** If provided, we will use this value and skip Supabase live fetching. */
  unreadTotal?: number;
  contentClassName?: string;
  children: ReactNode;
};

export default function Shell({ role, children, activeKey, unreadTotal: unreadTotalProp, contentClassName }: Props) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const pathname = usePathname();
  const router = useRouter();
  const isMessages = pathname?.startsWith("/messages");
  const [unreadTotal, setUnreadTotal] = useState<number>(unreadTotalProp ?? 0);
  const [displayName, setDisplayName] = useState<string>("");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  // Close desktop menu with ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDesktopOpen(false);
    };
    if (desktopOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [desktopOpen]);
  // Close desktop menu on route change
  useEffect(() => {
    setDesktopOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Keep local state in sync if parent provides unreadTotal
  useEffect(() => {
    if (typeof unreadTotalProp === "number") {
      setUnreadTotal(unreadTotalProp);
    }
  }, [unreadTotalProp]);

  // Load display name from Supabase (profiles table with fallbacks)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        // Prefer profiles.full_name, fallback to user metadata or email
        let name: string =
          (user.user_metadata?.full_name as string | undefined) || "";
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (prof?.full_name) name = prof.full_name;
        if (!name) name = user.email ?? "";
        if (!cancelled) setDisplayName(name);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Fetch unread total for sidebar badge (via RPC)
  const refetchUnread = useCallback(async () => {
    // Inline the user lookup to avoid a separate dependency changing every render
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;

    if (!uid) {
      setUnreadTotal(0);
      return;
    }

    const { data: count, error } = await supabase.rpc("unread_count_for_user", { uid });
    if (error) {
      console.warn("unread_count_for_user error", error.message);
      return;
    }
    setUnreadTotal(Number(count ?? 0));
  }, [supabase]);

  // Initial load + live updates on messages or read-state changes
  useEffect(() => {
    if (typeof unreadTotalProp === "number") {
      // Parent controls unreadTotal; skip live fetching
      return;
    }

    refetchUnread();

    const channel = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refetchUnread()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        () => refetchUnread()
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [refetchUnread, supabase, unreadTotalProp]);

  // Unified nav list for top navigation (desktop tabs + mobile select)
  const navItems: SidebarItem[] = useMemo(() => {
    const msgBadge =
      unreadTotal > 0 ? (
        <span
          className="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-slate-900"
          style={{ backgroundColor: "#D3F501" }}
        >
          {unreadTotal > 99 ? "99+" : unreadTotal}
        </span>
      ) : undefined;

    if (role === "student") {
      return [
        { key: "overview", label: "Home", href: "/student/dashboard", exact: true },
        { key: "messages", label: "Messages", href: "/messages", badge: msgBadge },
        { key: "lessons", label: "My Lessons", href: "/student/lessons" },
        { key: "saved", label: "Saved", href: "/student/saved" },
        { key: "find_tutors", label: "Find Tutors", href: "/tutors" },
        { key: "settings", label: "Settings", href: "/student/settings" },
        { key: "logout", label: "Log out", href: "#logout" },
      ];
    } else {
      return [
        { key: "overview", label: "Home", href: "/tutor/dashboard", exact: true },
        { key: "messages", label: "Messages", href: "/messages", badge: msgBadge },
        { key: "lessons", label: "My Lessons", href: "/tutor/lessons" },
        { key: "classroom", label: "Classroom", href: "/tutor/classroom" },
        { key: "availability", label: "Availability", href: "/tutor/availability" },
        { key: "insights", label: "Insights", href: "/tutor/insights" },
        { key: "settings", label: "Settings", href: "/tutor/settings" },
        { key: "logout", label: "Log out", href: "#logout" },
      ];
    }
  }, [role, unreadTotal]);

  const isActive = (item: SidebarItem) => {
    if (item.key === "logout") return false;
    if (activeKey) return item.key === activeKey;
    return pathname ? (item.exact ? pathname === item.href : pathname.startsWith(item.href)) : false;
  };

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore
    }
    router.replace("/");
  }, [router]);

  return (
    <div className={["min-h-screen", "bg-slate-50"].join(" ")}>
      {/* Top bar with logo and navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Row 1: Logo and user info (desktop), mobile menu button */}
          <div className="h-14 flex items-center justify-between gap-4">
            <Link
              href={role === "student" ? "/student/dashboard" : "/tutor/dashboard"}
              className="inline-flex items-center gap-2"
            >
              <Image
                src="/logo.svg"
                alt="HifzTutor"
                width={120}
                height={28}
                priority
                className="md:w-[140px] md:h-[32px] w-[120px] h-[28px]"
              />
            </Link>
            {/* Mobile dropdown trigger (icon only) */}
            {/* Mobile dropdown trigger (icon only) */}
            <div className="md:hidden ml-auto">
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
                className="inline-flex items-center justify-center rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]"
              >
                <Image src="/mobile-dropdown-icon.svg" alt="" width={24} height={24} />
              </button>
            </div>
            {/* Desktop dropdown trigger + menu (right side) */}
            <div className="hidden md:inline-flex items-center relative">
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setDesktopOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]"
              >
                <Image src="/desktop-dropdown-icon.svg" alt="" width={24} height={24} />
              </button>
              {desktopOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl z-50">
                  <div className="flex items-center gap-2 p-3 border-b">
                    <Image src="/desktop-dropdown-icon.svg" alt="" width={20} height={20} />
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {displayName || "Your account"}
                    </span>
                  </div>
                  <nav className="p-2">
                    <ul className="space-y-1">
                      {navItems
                        .filter((item) => item.key !== "settings" && item.key !== "logout")
                        .map((item) => (
                          <li key={item.key}>
                            <Link
                              href={item.href}
                              className={[
                                "relative flex items-center justify-between rounded-md px-3 py-2 text-[15px]",
                                isActive(item)
                                  ? "pl-4 text-slate-900 font-semibold"
                                  : "hover:bg-slate-50 text-slate-700 font-medium",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                              ].join(" ")}
                            >
                              <span>{item.label}</span>
                              {item.badge}
                              {isActive(item) ? (
                                <span
                                  className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 h-5 w-1.5 rounded-full"
                                  style={{ backgroundColor: "#D3F501" }}
                                  aria-hidden
                                />
                              ) : null}
                            </Link>
                          </li>
                        ))}

                      {/* Divider */}
                      <li aria-hidden className="my-2">
                        <div className="border-t border-slate-200" />
                      </li>

                      {navItems
                        .filter((item) => item.key === "settings" || item.key === "logout")
                        .map((item) => (
                          <li key={item.key}>
                            {item.key === "logout" ? (
                              <button
                                onClick={signOut}
                                className="w-full text-left rounded-md px-3 py-2 text-[15px] font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]"
                              >
                                {item.label}
                              </button>
                            ) : (
                              <Link
                                href={item.href}
                                className={[
                                  "relative flex items-center justify-between rounded-md px-3 py-2 text-[15px]",
                                  isActive(item)
                                    ? "pl-4 text-slate-900 font-semibold"
                                    : "hover:bg-slate-50 text-slate-700 font-medium",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                                ].join(" ")}
                              >
                                <span>{item.label}</span>
                                {item.badge}
                                {isActive(item) ? (
                                  <span
                                    className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 h-5 w-1.5 rounded-full"
                                    style={{ backgroundColor: "#D3F501" }}
                                    aria-hidden
                                  />
                                ) : null}
                              </Link>
                            )}
                          </li>
                        ))}
                    </ul>
                  </nav>
                </div>
              )}
            </div>
          </div>
          {/* Row 2: Navigation (tabs on desktop, select on mobile) */}
          <div className="h-12 hidden md:flex items-center justify-between border-t border-slate-100">
            {/* Desktop horizontal tabs */}
            <nav className="flex-1">
              <ul className="flex items-center gap-3 md:gap-4">
                {navItems.filter((i) => i.key !== "logout").map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={[
                        "relative inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[16px]",
                        isActive(item)
                          ? "text-[#111629] font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-medium",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                      ].join(" ")}
                      aria-current={isActive(item) ? "page" : undefined}
                    >
                      <span className="leading-none">{item.label}</span>
                      {item.badge}
                      {isActive(item) ? (
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
            </nav>
            {/* Removed desktop dropdown icon button for consistency with mobile drawer */}
          </div>
        </div>
      </header>

      {desktopOpen && (
        <div
          aria-hidden
          className="hidden md:block fixed inset-0 z-40"
          onClick={() => setDesktopOpen(false)}
        />
      )}

      {/* Mobile drawer (moved outside header so it overlays the whole page) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 backdrop-blur-[1px] bg-white/30"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-1/2 min-w-[280px] max-w-[360px] bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Image src="/desktop-dropdown-icon.svg" alt="" width={20} height={20} />
                <span className="text-base font-semibold text-slate-800 truncate max-w-[200px]">
                  {displayName || "Your account"}
                </span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]"
              >
                <span className="block text-xl leading-none">×</span>
              </button>
            </div>
            <nav className="p-2">
              <ul className="space-y-1">
                {navItems
                  .filter((item) => item.key !== "settings" && item.key !== "logout")
                  .map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={[
                          "flex items-center justify-between rounded-lg px-4 py-3.5 text-[16px]",
                          isActive(item)
                            ? "relative pl-4 text-slate-900 font-semibold"
                            : "hover:bg-slate-50 text-slate-700 font-medium",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                        ].join(" ")}
                        aria-current={isActive(item) ? "page" : undefined}
                      >
                        <span>{item.label}</span>
                        {item.badge}
                        {isActive(item) ? (
                          <span
                            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full"
                            style={{ backgroundColor: "#D3F501" }}
                            aria-hidden
                          />
                        ) : null}
                      </Link>
                    </li>
                  ))}

                {/* Divider */}
                <li aria-hidden className="my-2">
                  <div className="border-t border-slate-200" />
                </li>

                {/* Secondary: Settings + Log out */}
                {navItems
                  .filter((item) => item.key === "settings" || item.key === "logout")
                  .map((item) => (
                    <li key={item.key}>
                      {item.key === "logout" ? (
                        <button
                          onClick={() => {
                            setMobileOpen(false);
                            signOut();
                          }}
                          className="w-full text-left rounded-lg px-4 py-3.5 text-[16px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={[
                            "flex items-center justify-between rounded-lg px-4 py-3.5 text-[16px]",
                            isActive(item)
                              ? "relative pl-4 text-slate-900 font-semibold"
                              : "hover:bg-slate-50 text-slate-700 font-medium",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                          ].join(" ")}
                          aria-current={isActive(item) ? "page" : undefined}
                        >
                          <span>{item.label}</span>
                          {item.badge}
                          {isActive(item) ? (
                            <span
                              className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full"
                              style={{ backgroundColor: "#D3F501" }}
                              aria-hidden
                            />
                          ) : null}
                        </Link>
                      )}
                    </li>
                  ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* Page content */}
      {(() => {
        return (
          <main
            className={[
              isMessages
                ? "w-full px-0 pt-0 pb-0 overflow-hidden"
                : "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6",
              contentClassName ?? "",
            ].join(" ")}
          >
            {children}
          </main>
        );
      })()}
    </div>
  );
}