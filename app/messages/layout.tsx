"use client";

import type { ReactNode } from "react";
import Shell from "@shells/DashboardShell";
import MessagesShell from "@shells/MessagesShell";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";

export default function MessagesLayout({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const params = useParams();
  const filter = (searchParams?.get("filter") as "all" | "unread" | "archived") ?? "all";

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [conversations, setConversations] = useState<{ id: string; user_a: string; user_b: string; created_at: string }[]>([]);
  const [peerMeta, setPeerMeta] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const myId = s?.session?.user.id;
      if (!myId) return;
      if (!mounted) return;
      setMe({ id: myId, email: s?.session?.user.email ?? null });

      const { data: prof } = await supabase.from("profiles").select("role").eq("id", myId).maybeSingle();
      if (mounted) setRole(prof?.role === "tutor" ? "tutor" : "student");

      const { data: convs } = await supabase
        .from("conversations")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${myId},user_b.eq.${myId}`)
        .order("created_at", { ascending: false });
      if (mounted && convs) setConversations((convs as { id: string; user_a: string; user_b: string; created_at: string }[]) ?? []);

      const peerIds = Array.from(
        new Set(((convs as { user_a: string; user_b: string }[]) ?? []).map((c) => (c.user_a === myId ? c.user_b : c.user_a)))
      );
      if (peerIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", peerIds);
        if (mounted) {
          if (peerIds.length > 0 && !(profiles && profiles.length)) {
            console.warn("messages: bulk profiles returned 0 rows");
          }
          if (profiles && profiles.length) {
            const map: Record<string, { name: string; avatar: string | null }> = {};
            for (const p of profiles as Array<{ id: string; full_name?: string | null; avatar_url?: string | null }>) {
              const full = p.full_name?.trim();
              const fallbackId = p.id ? p.id.slice(0, 8) : "";
              const name = (full || fallbackId) as string;
              map[p.id] = { name, avatar: p.avatar_url ?? null };
            }
            // Merge into existing meta so previously known peers remain
            setPeerMeta((prev) => ({ ...prev, ...map }));
          }
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const filtered = conversations.map((c) => {
    const pid = c.user_a === me?.id ? c.user_b : c.user_a;
    return { id: c.id, peerId: pid, createdAt: new Date(c.created_at) };
  });

  // Mobile: show tabs + inbox on /messages, chat-only on /messages/[peerId]
  const isThread = Boolean(params?.peerId);
  const hideMobileTabs = isThread;
  const mobileHeightClass = isThread ? "h-[calc(100svh-3.5rem-1px)]" : "h-[calc(100svh-7rem-1px)]";

  return (
    <Shell role={role}>
      <MessagesShell activeKey={filter} hideDesktopTabs hideMobileTabs={hideMobileTabs}>
        <div className={`w-full overflow-hidden overscroll-none grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] md:divide-x md:divide-slate-200 ${mobileHeightClass} md:h-[calc(100vh-7rem-1px)]`}>
          {/* Left: Inbox (always visible on desktop) */}
          <aside
            className={[
              // Mobile: show inbox on /messages only; Desktop: always show
              isThread ? "hidden" : "flex",
              "md:flex md:flex-col bg-white h-full overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0",
            ].join(" ")}
          >
            {/* Desktop-only tabs above inbox */}
            <div className="sticky top-0 z-10 bg-white border-b hidden md:block">
              <div className="h-12 flex items-center gap-2 px-3">
                <Link href={`/messages`} className={`relative px-4 py-3 text-[15px] font-medium transition ${filter === 'all' ? 'text-[#111629] font-semibold' : 'text-slate-700 hover:text-[#111629]'}`}>
                  All
                  {filter === 'all' && (<span className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full" style={{ backgroundColor: '#D3F501' }} />)}
                </Link>
                <Link href={`/messages?filter=unread`} className={`relative px-4 py-3 text-[15px] font-medium transition ${filter === 'unread' ? 'text-[#111629] font-semibold' : 'text-slate-700 hover:text-[#111629]'}`}>
                  Unread
                  {filter === 'unread' && (<span className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full" style={{ backgroundColor: '#D3F501' }} />)}
                </Link>
                <Link href={`/messages?filter=archived`} className={`relative px-4 py-3 text-[15px] font-medium transition ${filter === 'archived' ? 'text-[#111629] font-semibold' : 'text-slate-700 hover:text-[#111629]'}`}>
                  Archived
                  {filter === 'archived' && (<span className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full" style={{ backgroundColor: '#D3F501' }} />)}
                </Link>
              </div>
            </div>

            {/* Inbox list scrolls inside left column */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:mb-0">
              <ul>
                {filtered.map((row) => {
                  const meta = peerMeta[row.peerId];
                  const name = meta?.name ?? 'Loading…';
                  const avatar = meta?.avatar || null;
                  const timeOrDay = row.createdAt?.toLocaleDateString() ?? '';
                  const isActive = pathname === `/messages/${row.peerId}`;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/messages/${row.peerId}${filter === 'all' ? '' : `?filter=${filter}`}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group flex items-center gap-3 px-3 py-3 transition-colors ${isActive ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="relative">
                          {avatar ? (
                            <Image src={avatar} alt={name} width={40} height={40} className="h-10 w-10 rounded-md object-cover border" />
                          ) : meta ? (
                            <div className="h-10 w-10 grid place-items-center rounded-md bg-slate-100 border text-[12px] font-semibold text-slate-700">
                              {name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-slate-200 animate-pulse" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-[15px] font-semibold text-[#111629]">
                              {meta ? name : <span className="inline-block h-3 w-24 bg-slate-200 rounded animate-pulse align-middle" aria-hidden="true" />}
                            </p>
                            <span className="shrink-0 text-[12px] text-slate-500">{timeOrDay}</span>
                          </div>
                        </div>
                      </Link>
                      <div className="h-px bg-slate-100 last:hidden" />
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Right: children (empty state on /messages, thread on /messages/[peerId]) */}
          <section
            className={[
              // Mobile: hide right pane on inbox route to avoid empty-state
              isThread ? "flex" : "hidden",
              "md:flex bg-white flex-col min-h-0 overflow-hidden h-full overscroll-contain",
            ].join(" ")}
          >
            {children}
          </section>
        </div>
      </MessagesShell>
    </Shell>
  );
}
