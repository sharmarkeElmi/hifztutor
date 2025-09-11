"use client";

/**
 * Messages — Inbox (MVP, members-based)
 * ------------------------------------------------------------
 * - Auth guard
 * - Renders INSIDE the dashboard Shell
 * - Lists conversations; we now read peer from conversations.user_a/user_b
 *   to avoid relying on seeing the other member row.
 * - Clicking a row navigates to /messages/[peerId]
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import Shell from "@shells/DashboardShell";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import MessagesShell from "@shells/MessagesShell";
import Link from "next/link";
import Image from "next/image";
import { cx } from "class-variance-authority";

// Types for a simple 1:1 conversation schema
type Conversation = {
  id: string;
  created_at: string;
  user_a: string;
  user_b: string;
};

type MemberRow = {
  conversation_id: string;
  last_read_at: string | null;
};

export default function MessagesInboxPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  // Peer profile meta for nicer list (name + avatar)
  type PeerMeta = { name: string; avatar: string | null };
  const [peerMeta, setPeerMeta] = useState<Record<string, PeerMeta>>({});



  // ---- Refetch helper (used by focus + realtime)
  const refetchConversations = useCallback(async () => {
    if (!me?.id) return;

    // 1) my membership rows (to get conversation IDs + last_read_at)
    const { data: myMemberships, error: membErr } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", me.id);

    if (membErr) {
      console.warn("refetchConversations: membership error", membErr);
      return;
    }

    const convIds = (myMemberships ?? []).map((m) => m.conversation_id);
    if (!convIds.length) {
      setConversations([]);
      setUnreadMap({});
      return;
    }

    // 2) conversations meta
    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id, created_at, user_a, user_b")
      .in("id", convIds)
      .order("created_at", { ascending: false });

    if (convErr) {
      console.warn("refetchConversations: conversations error", convErr);
      return;
    }

    setConversations((convs ?? []) as Conversation[]);

    // 3) unread counts per conversation (same logic as initial load)
    try {
      const memberByConv = new Map(
        ((myMemberships ?? []) as MemberRow[]).map((m) => [
          m.conversation_id,
          m.last_read_at ?? "1970-01-01T00:00:00Z",
        ])
      );

      const viewerId = me.id;

      const tasks = (convs ?? []).map(async (c) => {
        const lastRead = memberByConv.get(c.id) ?? "1970-01-01T00:00:00Z";

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .neq("sender_id", viewerId)
          .gt("created_at", lastRead);

        return [c.id, count ?? 0] as const;
      });

      const results = await Promise.all(tasks);
      setUnreadMap(Object.fromEntries(results));
    } catch (e) {
      console.warn("refetchConversations: unread counts failed", e);
    }
  }, [me?.id, supabase]);

  // ---- Auth + role + load my conversations
  useEffect(() => {
    let mounted = true;
    (async () => {
      // 1) session
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        window.location.replace("/student/signin");
        return;
      }
      const myId = session.user.id;
      const myEmail = session.user.email ?? null;
      if (!mounted) return;

      setMe({ id: myId, email: myEmail });

      // 2) my role (for Shell)
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", myId)
        .maybeSingle();

      if (myProfile?.role === "tutor") setRole("tutor");
      else setRole("student"); // default

      // 3) load my membership rows -> conversation IDs
      const { data: myMemberships, error: membErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, last_read_at")
        .eq("user_id", myId);

      if (membErr) {
        if (!mounted) return;
        console.warn("messages inbox: membership load error", membErr);
        setLoading(false);
        return;
      }

      const convIds = (myMemberships ?? []).map((m) => m.conversation_id);
      if (!convIds.length) {
        if (!mounted) return;
        setConversations([]);
        setLoading(false);
        return;
      }

      // 4) fetch conversations meta (includes user_a,user_b so we can compute peer without needing their member row)
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id, created_at, user_a, user_b")
        .in("id", convIds)
        .order("created_at", { ascending: false });

      if (convErr) {
        if (!mounted) return;
        console.warn("messages inbox: conversations load error", convErr);
        setConversations([]);
        setLoading(false);
        return;
      }

      if (!mounted) return;

      // 1) Set the conversations as before
      setConversations((convs ?? []) as Conversation[]);

      // 2) Compute unread counts per conversation (simple MVP approach)
      try {
        // Build a quick map of my last_read_at per conversation
        const memberByConv = new Map(
          ((myMemberships ?? []) as MemberRow[]).map((m) => [
            m.conversation_id,
            m.last_read_at ?? "1970-01-01T00:00:00Z",
          ])
        );

        const viewerId = myId; // reuse the session user id declared above; avoid shadowing

        // One count query per conversation (fine for MVP)
        const tasks = (convs ?? []).map(async (c) => {
          const lastRead = memberByConv.get(c.id) ?? "1970-01-01T00:00:00Z";

          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", c.id)
            .neq("sender_id", viewerId)
            .gt("created_at", lastRead);

          return [c.id, count ?? 0] as const;
        });

        const results = await Promise.all(tasks);
        if (mounted) {
          setUnreadMap(Object.fromEntries(results));
        }
      } catch (e) {
        console.warn("unread counts failed", e);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  // ---- Refetch triggers: window focus + realtime updates to my conversation_members rows
  useEffect(() => {
    if (!me?.id) return;

    const onFocus = () => {
      refetchConversations();
    };
    window.addEventListener("focus", onFocus);

    const ch = supabase
      .channel(`cm-updates-${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${me.id}`,
        },
        () => {
          refetchConversations();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(ch);
    };
  }, [me?.id, refetchConversations, supabase]);

  // ---- Also refetch when a thread broadcasts a localStorage "read" ping
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "__hifztutor_conv_read__") {
        refetchConversations();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refetchConversations]);

  // ---- Render list rows with derived peerId + createdAt
  const list = useMemo(() => {
    if (!me) return [];
    return (conversations ?? []).map((c) => {
      const peerId = c.user_a === me.id ? c.user_b : c.user_a;
      return {
        id: c.id,
        createdAt: new Date(c.created_at),
        peerId,
      };
    });
  }, [conversations, me]);

  // Fetch peer meta after conversations load
  useEffect(() => {
    if (!me) return;
    const peerIds = Array.from(new Set((conversations ?? []).map((c) => (c.user_a === me.id ? c.user_b : c.user_a))));
    if (!peerIds.length) {
      setPeerMeta({});
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", peerIds);
      const map: Record<string, PeerMeta> = {};
      for (const row of data ?? []) {
        map[row.id] = { name: row.full_name ?? "", avatar: row.avatar_url ?? null };
      }
      setPeerMeta(map);
    })();
  }, [me, conversations, supabase]);

  // ---- filter from query param
  const searchParams = useSearchParams();
  const filter = (searchParams?.get("filter") as "all" | "unread" | "archived") ?? "all";

  // Filter the left list by the active tab
  const filtered = useMemo(() => {
    if (filter === "unread") {
      return list.filter((row) => (unreadMap[row.id] ?? 0) > 0);
    }
    // TODO: archived support when we add a flag
    return list;
  }, [list, filter, unreadMap]);



  // ---- View
  if (loading) {
    return <p className="mt-10 text-center">Loading messages…</p>;
  }
  if (!me) return null;

  return (
    <Shell role={role} contentClassName="p-0">
      <MessagesShell activeKey={filter}>
        <div className="w-full grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] md:divide-x md:divide-slate-200">
          {/* Left rail: conversations list */}
          <aside className="bg-white h-[calc(100vh-6.5rem)] md:h-[calc(100vh-7.5rem)] overflow-y-auto">
            <ul>
              {filtered.map((row) => {
                const meta = peerMeta[row.peerId];
                const name = meta?.name || `User ${row.peerId.slice(0, 8)}…`;
                const avatar = meta?.avatar || null;
                const timeOrDay = row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "";
                const snippet = "Click to open the thread";
                return (
                  <li key={row.id}>
                    <Link
                      href={`/messages/${row.peerId}${filter === "all" ? "" : `?filter=${filter}`}`}
                      className={cx("group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50")}
                    >
                      <div className="relative">
                        {avatar ? (
                          <Image src={avatar} alt={name} width={40} height={40} className="h-10 w-10 rounded-md object-cover border" />
                        ) : (
                          <div className="h-10 w-10 grid place-items-center rounded-md bg-slate-100 border text-[12px] font-semibold text-slate-700">
                            {name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || row.peerId.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-[15px] font-semibold text-[#111629]">{name}</p>
                          <span className="shrink-0 text-[12px] text-slate-500">{timeOrDay}</span>
                        </div>
                        <p className="truncate text-[13px] text-slate-600">{snippet}</p>
                      </div>
                    </Link>
                    <div className="h-px bg-slate-100 last:hidden" />
                  </li>
                );
              })}
              {!filtered.length && (
                <li className="px-6 py-10 text-center text-sm text-slate-500">No conversations yet.</li>
              )}
            </ul>
          </aside>

          {/* Right pane: empty state */}
          <section className="bg-white h-[calc(100vh-6.5rem)] md:h-[calc(100vh-7.5rem)] overflow-hidden flex flex-col">
            <div className="flex-1 grid place-items-center p-6">
              <div className="text-center max-w-md">
                <h1 className="text-2xl font-semibold text-[#111629]">Messages</h1>
                <p className="mt-1 text-slate-500">Pick a conversation from the left to start chatting.</p>
              </div>
            </div>
          </section>
        </div>
      </MessagesShell>
    </Shell>
  );
}
