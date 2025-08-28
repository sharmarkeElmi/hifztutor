"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Role = "student" | "tutor";

type MenuItem = { label: string; href: string; disabled?: boolean };

// Role-specific menu items shown under “Menu”
const menuByRole: Record<Role, MenuItem[]> = {
  student: [
    { label: "Dashboard", href: "/student/dashboard" },
    { label: "Join live lesson", href: "/lesson/join" },
    { label: "Messages", href: "/messages" },
    { label: "Schedule", href: "/student/schedule", disabled: true },
  ],
  tutor: [
    { label: "Dashboard", href: "/tutor/dashboard" },
    { label: "Join live lesson", href: "/lesson/join" },
    { label: "Messages", href: "/messages" },
    { label: "Schedule", href: "/tutor/schedule", disabled: true },
  ],
};

// Always shown at the bottom under “General”
const general: MenuItem[] = [
  { label: "Settings", href: "/settings", disabled: true },
  { label: "Help", href: "/help", disabled: true },
];

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [unreadTotal, setUnreadTotal] = useState<number>(0);

  // Scoped, memoized Supabase client (stable ref per component instance)
  const supabase = useMemo(() => createClientComponentClient(), []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign(role === "tutor" ? "/tutor/signin" : "/student/signin");
  };

  const isActive = (itemHref: string) => pathname?.startsWith(itemHref);

  // Fetch total unread messages for the current user
  const fetchUnread = useMemo(() => {
    return async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const myId = userRes?.user?.id;
      if (!myId) {
        setUnreadTotal(0);
        return;
      }

      const { data: members, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id,last_read_at")
        .eq("user_id", myId);

      if (memErr || !members || members.length === 0) {
        setUnreadTotal(0);
        return;
      }

      const counts = await Promise.all(
        members.map(async (m) => {
          let query = supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", m.conversation_id)
            .neq("sender_id", myId);

          if (m.last_read_at) {
            query = query.gt("created_at", m.last_read_at as string);
          }

          const { count } = await query;
          return count ?? 0;
        })
      );

      const total = counts.reduce((a, b) => a + b, 0);
      setUnreadTotal(total);
    };
    // include supabase so lint is happy; ref is stable due to useMemo above
  }, [supabase]);

  useEffect(() => {
    // initial load
    fetchUnread();

    // refresh on focus to catch up if tab was inactive
    const onFocus = () => fetchUnread();
    window.addEventListener("focus", onFocus);

    // realtime: refetch when a new message arrives anywhere
    const channel = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchUnread()
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchUnread, supabase]);

  const renderItem = (item: MenuItem) => {
    const active = isActive(item.href);

    const base = "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors";
    const activeCls = "bg-white shadow-sm text-[#0E3A32]"; // Deep Green
    const idle = "text-slate-600 hover:bg-white/70 hover:text-[#0E3A32]";
    const disabled = "cursor-not-allowed text-slate-400";

    // Badge for Messages
    const showBadge = item.label === "Messages" && unreadTotal > 0;

    if (item.disabled) {
      return (
        <span key={item.label} className={`${base} ${disabled}`}>
          {item.label}
        </span>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={`${base} ${active ? activeCls : idle}`}>
        <span>{item.label}</span>
        {showBadge && (
          <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#F7D949] px-2 py-0.5 text-xs font-semibold text-[#0E3A32]">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="h-fit rounded-xl border bg-[#F2F7FA] p-4">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Menu
      </div>
      <nav className="space-y-1">{menuByRole[role].map(renderItem)}</nav>

      <div className="mt-4 border-t px-2 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        General
      </div>
      <nav className="space-y-1">
        {general.map(renderItem)}
        <button
          onClick={signOut}
          className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-white/70 hover:text-[#0E3A32]"
        >
          Sign out
        </button>
      </nav>
    </aside>
  );
}