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
import { supabase } from "@/lib/supabase";

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

async function getMyId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export default function Shell({ role, children, activeKey }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  // Fetch unread total for sidebar badge (via RPC)
  const refetchUnread = useCallback(async () => {
    const uid = await getMyId();
    if (!uid) {
      setUnreadTotal(0);
      return;
    }
    const { data, error } = await supabase.rpc("unread_count_for_user", { uid });
    if (error) {
      console.warn("unread_count_for_user error", error.message);
      return;
    }
    setUnreadTotal(Number(data ?? 0));
  }, []);

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
  }, [refetchUnread]);

  // Primary menu (MVP)
  const menu: NavItem[] = useMemo(() => {
    if (role === "student") {
      return [
        { key: "overview", label: "Overview", href: "/student/dashboard", exact: true },
        { key: "lessons", label: "Lessons", href: "/student/lessons" },
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

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: `radial-gradient(1200px 600px at 10% -10%, ${BRAND.cool} 0%, transparent 60%)`,
        backgroundColor: "#ffffff",
      }}
    >
      <div className="mx-auto max-w-[1340px] px-6 py-10 lg:px-8">
        <div className="flex gap-8">
          {/* ================= Sidebar ================= */}
          <aside className="w-[300px] shrink-0 md:w-[320px]">
            <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white shadow-[0_6px_30px_-12px_rgba(0,0,0,0.12)]">
              {/* Brand strip */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
                {/* Replace this square with your final SVG mark when ready */}
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl shadow-sm ring-1 ring-slate-900/10"
                  style={{ backgroundColor: BRAND.yellow }}
                  aria-hidden
                >
                  <span className="text-slate-900 text-[11px] font-bold leading-none">▮▮</span>
                </span>
                <div className="leading-tight">
                  <p className="text-[18px] font-extrabold tracking-tight text-slate-900">HifzTutor</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    {role === "tutor" ? "Tutor" : "Student"}
                  </p>
                </div>
              </div>

              {/* Nav */}
              <nav className="px-3 py-8">
                <ul className="space-y-1.5">
                  {menu.map((item) => {
                    const active = isActive(item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={[
                            "group flex items-center rounded-xl px-4 py-3 text-[15px] font-semibold transition-all",
                            active ? "text-white" : "text-slate-700 hover:text-slate-900",
                          ].join(" ")}
                          style={{
                            backgroundColor: active ? BRAND.deep : "transparent",
                            boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.04)" : "none",
                          }}
                        >
                          {/* left accent bar */}
                          <span
                            className="mr-3 block h-5 w-1.5 rounded-full"
                            style={{ backgroundColor: active ? BRAND.yellow : "transparent" }}
                          />
                          <span className="truncate">{item.label}</span>
                          {item.key === "messages" && unreadTotal > 0 && (
                            <span
                              className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-slate-900"
                              style={{ backgroundColor: BRAND.yellow }}
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

                {/* Divider */}
                <div className="mx-4 my-6 h-px bg-slate-100" />

                {/* Sign out */}
                <div className="px-3 pb-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          {/* ================= Main content ================= */}
          <main className="min-w-0 flex-1">
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