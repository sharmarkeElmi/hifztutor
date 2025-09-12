"use client";

import Shell from "@shells/DashboardShell";
import MessagesShell from "@shells/MessagesShell";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const params = useParams();
  const filter = (searchParams?.get("filter") as "all" | "unread" | "archived") ?? "all";

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [conversations, setConversations] = useState<{ id: string; user_a: string; user_b: string; created_at: string }[]>([]);
  const [peerMeta, setPeerMeta] = useState<Record<string, { name: string; avatar: string | null }>>({});

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
      if (mounted && convs) setConversations(convs as any);

      const peerIds = Array.from(new Set((convs ?? []).map((c: any) => (c.user_a === myId ? c.user_b : c.user_a))));
      if (peerIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,full_name,display_name,avatar_url,email")
          .in("id", peerIds);
        if (mounted && profiles) {
          const map: Record<string, { name: string; avatar: string | null }> = {};
          for (const p of profiles) {
            const name = (p.display_name?.trim() || p.full_name?.trim() || p.email || p.id) as string;
            map[p.id] = { name, avatar: p.avatar_url ?? null };
          }
          setPeerMeta(map);
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

  // Hide mobile tabs in thread view (when peerId present)
  const hideMobileTabs = Boolean(params?.peerId);

  return (
    <Shell role={role}>
      <MessagesShell activeKey={filter} hideDesktopTabs hideMobileTabs={hideMobileTabs}>
        <div className="w-full overflow-hidden grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] md:divide-x md:divide-slate-200 h-[calc(100vh-7.5rem)]">
          {/* Left: Inbox (always visible on desktop) */}
          <aside className="hidden md:flex md:flex-col bg-white">
            {/* Desktop-only tabs above inbox */}
            <div className="sticky top-0 z-10 bg-white border-b">
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
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ul>
                {filtered.map((row) => {
                  const meta = peerMeta[row.peerId];
                  const name = meta?.name || `User ${row.peerId.slice(0, 8)}…`;
                  const avatar = meta?.avatar || null;
                  const timeOrDay = row.createdAt?.toLocaleDateString() ?? "";
                  const isActive = typeof window !== 'undefined' && window.location.pathname === `/messages/${row.peerId}`;
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
                          ) : (
                            <div className="h-10 w-10 grid place-items-center rounded-md bg-slate-100 border text-[12px] font-semibold text-slate-700">
                              {name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-[15px] font-semibold text-[#111629]">{name}</p>
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
          <section className="bg-white flex flex-col min-h-0 overflow-hidden">{children}</section>
        </div>
      </MessagesShell>
    </Shell>
  );
}

