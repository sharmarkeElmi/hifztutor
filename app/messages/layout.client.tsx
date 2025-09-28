"use client";

import type { ReactNode } from "react";
import Shell from "@shells/DashboardShell";
import MessagesShell from "@shells/MessagesShell";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import type { UnreadCounts } from "@/lib/messages";
import { READ_STATE_EVENT } from "@/lib/messages";

export default function MessagesLayoutClient({
  children,
  initialUnreadCounts,
}: {
  children: ReactNode;
  initialUnreadCounts?: UnreadCounts | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const params = useParams();
  const filter = (searchParams?.get("filter") as "all" | "unread" | "archived") ?? "all";

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [conversations, setConversations] = useState<{ id: string; user_a: string; user_b: string; created_at: string }[]>([]);
  const [peerMeta, setPeerMeta] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [lastByConv, setLastByConv] = useState<Record<string, { content: string; created_at: string }>>({});
  const pathname = usePathname();

  // Local unread map for left list pills
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(
    () => initialUnreadCounts?.perConversation ?? {}
  );

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as UnreadCounts;
      setUnreadMap(data?.perConversation ?? {});
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setUnreadMap(initialUnreadCounts?.perConversation ?? {});
  }, [initialUnreadCounts?.perConversation]);

  useEffect(() => {
    const handler = () => refreshCounts();
    if (typeof window !== "undefined") {
      window.addEventListener(READ_STATE_EVENT, handler);
    }
    const id = setInterval(refreshCounts, 20000);
    return () => {
      if (typeof window !== "undefined") window.removeEventListener(READ_STATE_EVENT, handler);
      clearInterval(id);
    };
  }, [refreshCounts]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Failed to verify auth in messages layout:", userError.message);
      }
      const myId = userData?.user?.id;
      if (!myId) return;
      if (!mounted) return;
      setMe({ id: myId, email: userData?.user?.email ?? null });

      const { data: prof } = await supabase.from("profiles").select("role").eq("id", myId).maybeSingle();
      if (mounted) setRole(prof?.role === "tutor" ? "tutor" : "student");

      const { data: convs } = await supabase
        .from("conversations")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${myId},user_b.eq.${myId}`)
        .order("created_at", { ascending: false });
      if (mounted && convs) setConversations((convs as { id: string; user_a: string; user_b: string; created_at: string }[]) ?? []);

      // Fetch latest message preview per conversation (simple per-conv query for MVP)
      try {
        const ids = ((convs as { id: string }[]) ?? []).map((c) => c.id);
        const previews: Record<string, { content: string; created_at: string }> = {};
        await Promise.all(
          ids.map(async (cid) => {
            const { data: m } = await supabase
              .from("messages")
              .select("content,created_at")
              .eq("conversation_id", cid)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle<{ content: string; created_at: string }>();
            if (m) previews[cid] = { content: m.content, created_at: m.created_at };
          })
        );
        if (mounted) setLastByConv(previews);
      } catch {
        // ignore preview errors; UI remains functional
      }

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
            setPeerMeta((prev) => ({ ...prev, ...map }));
          }
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const baseList = conversations.map((c) => {
    const pid = c.user_a === me?.id ? c.user_b : c.user_a;
    return { id: c.id, peerId: pid, createdAt: new Date(c.created_at) };
  });
  const list = baseList.filter((row) => {
    if (filter === "unread") {
      return (unreadMap[row.id] ?? 0) > 0;
    }
    if (filter === "archived") {
      // TODO: implement when archived flag/relationship exists
      return false;
    }
    return true; // 'all'
  });

  const isThread = Boolean(params?.peerId);
  const hideMobileTabs = isThread;
  const mobileHeightClass = isThread ? "h-[calc(100svh-3.5rem-1px)]" : "h-[calc(100svh-7rem-1px)]";

  return (
    <Shell role={role}>
      <MessagesShell activeKey={filter} hideMobileTabs={hideMobileTabs} hideDesktopTabs initialUnreadCounts={initialUnreadCounts ?? undefined}>
        <div className={`w-full overflow-hidden overscroll-none grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] md:divide-x md:divide-slate-200 ${mobileHeightClass} md:h-[calc(100vh-7rem-1px)]`}>
          {/* Left: Inbox */}
          <aside
            className={[
              isThread ? "hidden" : "flex",
              "md:flex md:flex-col bg-white h-full overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0",
            ].join(" ")}
          >
            {/* Desktop-only tabs header above inbox (sticky, h-12) */}
            <div className="hidden md:block sticky top-0 z-10 bg-white border-b">
              <div className="h-16 flex items-center gap-3 sm:gap-4 px-4 sm:px-6">
                <Link
                  href={`/messages?filter=all`}
                  className={`relative inline-flex items-center rounded-md px-3.5 sm:px-4 py-2 text-[15px] sm:text-[16px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] focus-visible:ring-offset-2 hover:bg-slate-50 ${filter === 'all' ? 'text-[#111629] font-bold' : 'text-slate-600 hover:text-[#111629]'}`}
                  aria-current={filter === 'all' ? 'page' : undefined}
                >
                  All
                  {filter === 'all' && (
                    <span
                      className="pointer-events-none absolute left-0 right-0 bottom-[-12px] h-[3px] rounded-full"
                      style={{ backgroundColor: '#D3F501' }}
                    />
                  )}
                </Link>
                <Link
                  href={`/messages?filter=unread`}
                  className={`relative inline-flex items-center rounded-md px-3.5 sm:px-4 py-2 text-[15px] sm:text-[16px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] focus-visible:ring-offset-2 hover:bg-slate-50 ${filter === 'unread' ? 'text-[#111629] font-bold' : 'text-slate-600 hover:text-[#111629]'}`}
                  aria-current={filter === 'unread' ? 'page' : undefined}
                >
                  Unread
                  {filter === 'unread' && (
                    <span
                      className="pointer-events-none absolute left-0 right-0 bottom-[-12px] h-[3px] rounded-full"
                      style={{ backgroundColor: '#D3F501' }}
                    />
                  )}
                </Link>
                <button
                  type="button"
                  title="Coming soon"
                  aria-disabled="true"
                  className={`relative inline-flex items-center rounded-md px-3.5 sm:px-4 py-2 text-[15px] sm:text-[16px] text-slate-400 cursor-not-allowed`}
                >
                  Archived
                </button>
              </div>
            </div>

            {/* Inbox list scrolls inside left column */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:mb-0">
              {filter === "unread" && list.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-600">
                  <p className="text-[15px] font-semibold text-[#111629]">You’ve read all your messages</p>
                  <p className="mt-1 text-sm">We will notify you when you have new messages</p>
                </div>
              ) : null}
              <ul>
                {list.map((row) => {
                  const meta = peerMeta[row.peerId];
                  const name = meta?.name ?? 'Loading…';
                  const avatar = meta?.avatar || null;
                  const latestAt = lastByConv[row.id]?.created_at || row.createdAt?.toISOString() || '';
                  const timeOrDay = latestAt ? new Date(latestAt).toLocaleDateString() : '';
                  const isActive = pathname === `/messages/${row.peerId}`;
                  const unread = unreadMap[row.id] ?? 0;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/messages/${row.peerId}?filter=${filter}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={[
                          'relative flex items-center justify-between px-4 py-3.5 transition-colors',
                          isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                        ].join(' ')}
                      >
                        {/* Left: avatar + name */}
                        <div className="flex items-center gap-3 min-w-0">
                          {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatar}
                              alt={name}
                              className="h-9 w-9 rounded-md object-cover border"
                              loading="lazy"
                            />
                          ) : meta ? (
                            <Image
                              src="/desktop-dropdown-icon.svg"
                              alt="Default avatar"
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-md border"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-slate-200 animate-pulse" aria-hidden="true" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[15px] sm:text-[16px] font-semibold text-[#111629]">
                              {meta ? name : <span className="inline-block h-3 w-24 bg-slate-200 rounded animate-pulse align-middle" aria-hidden="true" />}
                            </p>
                            <p className="mt-0.5 truncate text-[13px] text-slate-600">
                              {lastByConv[row.id]?.content ?? ''}
                            </p>
                          </div>
                        </div>
                        {/* Right: time + unread dot */}
                        <div className="ml-3 shrink-0 flex items-center gap-2">
                          <span className="text-[12px] text-slate-500">{timeOrDay}</span>
                          {unread > 0 ? (
                            <span
                              aria-label={`${unread} unread`}
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: '#D3F501' }}
                            />
                          ) : null}
                        </div>
                        {/* Removed active left accent; rely on row background + separators */}
                      </Link>
                      <div className="border-b border-slate-300" />
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Right: children (thread). Thread header remains sticky inside the page; aligns with left tabs */}
          <section
            className={[
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
