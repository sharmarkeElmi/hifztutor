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
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";

// 🔧 Include "availability" to match tutor menu
type NavKey = "overview" | "lessons" | "messages" | "settings" | "availability";

type Props = {
  role: "student" | "tutor";
  /**
   * Optional explicit active key. Useful for deep routes
   * like /messages/[peerId] or /lesson/[room], where
   * pathname prefix matching isn’t reliable.
   */
  activeKey?: NavKey;
  children: ReactNode;
};

type NavItem = { key: NavKey; label: string; href: string; exact?: boolean };

const BRAND = {
  deep: "#0B2526",   // brand deep green
  yellow: "#F7D949", // brand yellow
  cool: "#EBF4F6",   // subtle page tint
};

export default function Shell({ role, children, activeKey }: Props) {
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
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

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
  }, [refetchUnread, supabase]);

  // Primary menu (MVP)
  const menu: NavItem[] = useMemo(() => {
    if (role === "student") {
      return [
        { key: "overview", label: "Overview", href: "/student/dashboard", exact: true },
        { key: "lessons", label: "My Lessons", href: "/student/lessons" },
        { key: "messages", label: "Messages", href: "/messages" },
        { key: "settings", label: "Settings", href: "/student/settings" },
      ];
    } else {
      return [
        { key: "overview", label: "Overview", href: "/tutor/dashboard", exact: true },
        { key: "lessons", label: "Lessons", href: "/tutor/lessons" },
        { key: "availability", label: "Availability", href: "/tutor/availability" }, // tutor-only
        { key: "messages", label: "Messages", href: "/messages" },
        { key: "settings", label: "Settings", href: "/tutor/settings" },
      ];
    }
  }, [role]);

  // Active helper – prefer explicit activeKey when provided
  const isActive = (item: NavItem) => {
    if (activeKey) return item.key === activeKey;
    return pathname ? (item.exact ? pathname === item.href : pathname.startsWith(item.href)) : false;
  };

  // Sign out then route to the correct sign-in for this role
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    router.replace(role === "tutor" ? "/tutor/signin" : "/student/signin");
    if (error) console.error("Sign out error:", error.message);
  };

  // Separate main menu items excluding "settings"
  const mainMenu = menu.filter(item => item.key !== "settings");
  // Extract the settings item
  const settingsItem = menu.find(item => item.key === "settings");

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: `radial-gradient(1200px 600px at 10% -10%, 0%, transparent 60%)`,
        backgroundColor: "#CDD5E0",
      }}
    >
      <div className="mx-auto max-w-[1340px] px-6 py-10 lg:px-8">
        <div className="flex gap-8">
          {/* ================= Sidebar ================= */}
          <aside className="w-[300px] shrink-0 md:w-[320px]">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.20)] h-[90vh] overflow-hidden flex flex-col justify-between">
              {/* Brand strip */}
              <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-6 rounded-t-3xl rounded-b-xl" style={{ backgroundColor: "#111629" }}>
                <div className="shrink-0">
                  <Image
                    src="/logo-mark-dark.svg"
                    alt="Hifztutor"
                    width={40}
                    height={40}
                    priority
                    className="block"
                  />
                </div>
                <div className="leading-tight">
                  <p className="text-[18px] font-extrabold tracking-tight text-white">HifzTutor</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">
                    {role === "tutor" ? "Tutor" : "Student"}
                  </p>
                </div>
              </div>

              {/* Nav and footer container */}
              <nav className="flex flex-col justify-between h-full px-3 py-8">
                {/* Top nav items */}
                <ul className="space-y-1.5">
                  {mainMenu.map((item) => {
                    const active = isActive(item);
                    return (
                      /* Tab highlight */
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={[
                            "group flex items-center rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors duration-200 ease-in-out",
                            active
                              ? "text-white"
                              : "text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40",
                          ].join(" ")}
                          style={{
                            backgroundColor: active ? "#111629" : "transparent",
                            boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.04)" : "none",
                          }}
                        >
                          {/* left accent bar with animated hover */}
                          <span
                            className={[
                              "mr-3 block h-5 rounded-full transition-all duration-200",
                              // thin bar by default, grows on hover; when active we keep it wider via inline style below
                              "w-1 group-hover:w-1.5",
                              // on hover, use brand yellow via Tailwind arbitrary value
                              "group-hover:bg-[#F7D949]",
                            ].join(" ")}
                            style={{ backgroundColor: active ? '#D3F501': "transparent" }}
                          />

                          {item.key === "messages" && (
                            <Image
                              src="/messages-icon.svg"
                              alt="Messages"
                              width={20}
                              height={20}
                              className="shrink-0 mr-2"
                            />
                          )}
                          <span className="truncate">{item.label}</span>
                          {item.key === "messages" && unreadTotal > 0 && (
                            <span
                              className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-slate-900 shadow-sm"
                              style={{ backgroundColor: '#D3F501' }}
                              aria-label={`${unreadTotal} unread messages`}
                            >
                              {unreadTotal > 99 ? "99+" : unreadTotal}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {/* Bottom nav with Settings and Sign out */}
                <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col space-y-2">
                  {settingsItem && (
                    <Link
                      href={settingsItem.href}
                      aria-current={isActive(settingsItem) ? "page" : undefined}
                      className={[
                        "group flex items-center rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors duration-200 ease-in-out",
                        isActive(settingsItem)
                          ? "text-white"
                          : "text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40",
                      ].join(" ")}
                      style={{
                        backgroundColor: isActive(settingsItem) ? "#1B3F3F" : "transparent",
                        boxShadow: isActive(settingsItem) ? "inset 0 0 0 1px rgba(255,255,255,0.04)" : "none",
                      }}
                    >
                      <span
                        className={[
                          "mr-3 block h-5 rounded-full transition-all duration-200",
                          "w-1 group-hover:w-1.5",
                          "group-hover:bg-[#F7D949]",
                        ].join(" ")}
                        style={{ backgroundColor: isActive(settingsItem) ? BRAND.yellow : "transparent" }}
                      />
                      <span className="truncate">{settingsItem.label}</span>
                    </Link>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="group flex items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Image
                      src="/signout-icon.svg"
                      alt="Sign out"
                      width={20}
                      height={20}
                      className="shrink-0"
                    />
                    <span>Sign out</span>
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          {/* ================= Main content ================= */}
          <main className="min-w-0 flex-1 h-[90vh]">
            {/* subtle top spacing to echo inspo layout */}
            <div className="mb-4" />
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_6px_30px_-12px_rgba(0,0,0,0.12)] md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}