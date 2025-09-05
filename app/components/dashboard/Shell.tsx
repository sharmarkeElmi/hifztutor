// app/components/dashboard/Shell.tsx
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
  /** Optional external sign-out handler (e.g., API route). */
  handleSignOut?: () => void | Promise<void>;
  children: ReactNode;
};



export default function Shell({ role, children, activeKey, unreadTotal: unreadTotalProp, handleSignOut: handleSignOutProp }: Props) {
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
  const [unreadTotal, setUnreadTotal] = useState<number>(unreadTotalProp ?? 0);

  // Keep local state in sync if parent provides unreadTotal
  useEffect(() => {
    if (typeof unreadTotalProp === "number") {
      setUnreadTotal(unreadTotalProp);
    }
  }, [unreadTotalProp]);

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

  const defaultSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    router.replace(role === "tutor" ? "/tutor/signin" : "/student/signin");
    if (error) console.error("Sign out error:", error.message);
  }, [router, role, supabase]);

  const signOut = useCallback(async () => {
    if (handleSignOutProp) return await handleSignOutProp();
    return defaultSignOut();
  }, [handleSignOutProp, defaultSignOut]);

  const handleSelectNav = (value: string) => {
    if (value === "#logout") {
      signOut();
    } else {
      router.push(value);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar with logo and navigation */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Row 1: Logo (and future actions) */}
          <div className="h-14 flex items-center justify-between gap-4">
            <Link
              href={role === "student" ? "/student/dashboard" : "/tutor/dashboard"}
              className="inline-flex items-center gap-2"
            >
              <Image src="/logo.svg" alt="HifzTutor" width={112} height={24} priority />
            </Link>
            {/* Mobile dropdown inside top header row */}
            <div className="md:hidden flex-1">
              <label className="sr-only" htmlFor="dash-nav">Navigation</label>
              <select
                id="dash-nav"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={navItems.find((i) => isActive(i))?.href ?? navItems[0].href}
                onChange={(e) => handleSelectNav(e.target.value)}
              >
                {navItems.map((item) => (
                  <option key={item.key} value={item.href === "#logout" ? "#logout" : item.href}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Right-side space reserved for future controls (e.g., refer a friend, language) */}
            <div className="hidden md:block" />
          </div>

          {/* Row 2: Navigation (tabs on desktop, select on mobile) */}
          <div className="h-12 hidden md:flex items-center border-t border-slate-100">
            {/* Desktop horizontal tabs */}
            <nav className="w-full">
              <ul className="flex items-center gap-2">
                {navItems.map((item) => (
                  <li key={item.key}>
                    {item.key === "logout" ? (
                      <button
                        onClick={signOut}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm",
                          isActive(item)
                            ? "border-[#F7D250] bg-[#FFF3C2] text-[#111629]"
                            : "border-transparent text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                        aria-current={isActive(item) ? "page" : undefined}
                      >
                        <span>{item.label}</span>
                        {item.badge}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}