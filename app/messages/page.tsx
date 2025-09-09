"use client";

/**
 * Messages — Inbox (MVP, members-based)
 * ------------------------------------------------------------
 * - Auth guard
 * - Renders INSIDE the dashboard Shell
 * - Lists conversations; we now read peer from conversations.user_a/user_b
 *   to avoid relying on seeing the other member row.
 * - Clicking a row navigates to /messages/[peerId]
 * - Dev helper uses PEER UUID (not email)
 */

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Shell from "../components/dashboard/Shell";
import type { PostgrestError } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import MessagesShell from "../components/messages/MessagesShell";

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
  const [error, setError] = useState<string | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  // Peer profile meta for nicer list (name + avatar)
  type PeerMeta = { name: string; avatar: string | null };
  const [peerMeta, setPeerMeta] = useState<Record<string, PeerMeta>>({});

  // Dev helper: start a conversation by the other user's UUID
  const [peerIdInput, setPeerIdInput] = useState("");
  const [starting, setStarting] = useState(false);

  // Thread (right pane) state
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  type MessageRow = { id: string; created_at: string; sender_id: string; content: string; conversation_id: string };
  const [msgs, setMsgs] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

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
        setError(membErr.message);
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
        setError(convErr.message);
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

  // Helper to detect Supabase unique constraint violations without using `any`
  const isUniqueViolation = (e: PostgrestError | null | undefined): boolean => {
    return e?.code === "23505";
  };

  const getOrCreateConversationId = useCallback(async (peerId: string): Promise<string | null> => {
    if (!me) return null;
    const [a, b] = me.id < peerId ? [me.id, peerId] : [peerId, me.id];
    // Try fetch existing either-order
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`)
      .maybeSingle();
    if (existing?.id) return existing.id;

    // Create if missing (UPSERT on ordered pair)
    const { data: upserted, error: upErr } = await supabase
      .from("conversations")
      .upsert({ user_a: a, user_b: b }, { onConflict: "user_a,user_b" })
      .select("id")
      .single();
    if (upErr) return null;

    // Ensure my membership
    {
      const { error: membErr } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: upserted!.id, user_id: me.id });
      if (membErr && membErr.code !== "23505") {
        console.warn("membership insert failed", membErr);
      }
    }
    return upserted!.id;
  }, [me, supabase]);

  const loadThreadForPeer = useCallback(async (peerId: string) => {
    if (!me) return;
    setLoadingThread(true);
    setSelectedPeerId(peerId);

    const convId = await getOrCreateConversationId(peerId);
    if (!convId) {
      setLoadingThread(false);
      return;
    }
    setSelectedConvId(convId);

    // Fetch messages
    const { data: rows } = await supabase
      .from("messages")
      .select("id, created_at, sender_id, content, conversation_id")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMsgs((rows ?? []) as MessageRow[]);

    // Mark read
    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .eq("user_id", me.id);

    // Scroll to bottom
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });

    setLoadingThread(false);
  }, [me, supabase, getOrCreateConversationId]);

  useEffect(() => {
    if (!selectedConvId) return;
    const ch = supabase
      .channel(`msg-ins-${selectedConvId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConvId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMsgs((prev) => [...prev, row]);
          requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedConvId, supabase]);

  const canSend = text.trim().length > 0 && !!selectedConvId;
  const handleSend = async () => {
    if (!canSend || !me) return;
    setSending(true);
    const body = text.trim();
    setText("");
    await supabase.from("messages").insert({ conversation_id: selectedConvId!, sender_id: me.id, content: body });
    setSending(false);
  };

  // ---- Start a conversation (dev) by PEER UUID
  const handleStartConversationDev = async () => {
    if (!me) return;
    const raw = peerIdInput.trim();
    if (!raw) return;

    // 1) Self-protection: no self-DM
    if (raw === me.id) {
      alert("You can’t start a conversation with yourself. Paste the OTHER user’s UUID.");
      return;
    }

    // 2) Canonicalize pair (store as [a < b]) to satisfy constraints/uniques
    const [a, b] = me.id < raw ? [me.id, raw] : [raw, me.id];

    try {
      setStarting(true);

      // 3) Create-or-reuse the conversation using UPSERT on the pair (user_a,user_b)
      //    This avoids the duplicate-key dance and works whether the row already exists.
      //    NOTE: your table must have a UNIQUE index on (user_a, user_b).
      const { data: upserted, error: upErr } = await supabase
        .from("conversations")
        .upsert({ user_a: a, user_b: b }, { onConflict: "user_a,user_b" })
        .select("id")
        .single();

      let convId: string | null = null;

      if (upErr) {
        // Some older rows may have been created before we enforced the A<B ordering.
        // As a fallback, try to fetch with either ordering.
        const { data: existing, error: findEitherErr } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`
          )
          .maybeSingle();

        if (!existing) {
          setStarting(false);
          alert(findEitherErr?.message ?? "Conversation exists but could not be fetched.");
          return;
        }
        convId = existing.id;
      } else {
        convId = upserted!.id;
      }

      // 4) Ensure MY membership exists (we only insert the current user's row).
      //    In RLS we normally only allow inserting your own membership.
      const { error: membErr } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: convId!, user_id: me.id });

      if (membErr && !isUniqueViolation(membErr)) {
        setStarting(false);
        alert(membErr.message ?? "Failed to add membership.");
        return;
      }

      setStarting(false);

      // Select newly created/located conversation in-place
      setSelectedPeerId(raw);
      const conv = await getOrCreateConversationId(raw);
      if (conv) {
        setSelectedConvId(conv);
        loadThreadForPeer(raw);
      }
    } catch (e: unknown) {
      console.error(e);
      setStarting(false);
      alert("Failed to start conversation.");
    }
  };

  // ---- View
  if (loading) {
    return <p className="mt-10 text-center">Loading messages…</p>;
  }
  if (!me) return null;

  return (
    <Shell role={role} contentClassName="p-0">
      <MessagesShell activeKey={filter}>
        <div className="w-full grid grid-cols-1 md:grid-cols-[var(--inbox-sidebar-w,400px)_minmax(0,1fr)] gap-0 md:divide-x md:divide-slate-200 overflow-hidden">
          {/* Left rail: conversations list */}
          <aside className="bg-white h-full overflow-y-auto">
            <ul className="divide-y">
              {filtered.map((row) => (
                <li key={row.id}>
                  {(() => {
                    const meta = peerMeta[row.peerId];
                    const name = meta?.name || `User ${row.peerId.slice(0, 8)}…`;
                    const avatar = meta?.avatar || null;
                    const unread = unreadMap[row.id] ?? 0;
                    const active = selectedPeerId === row.peerId;
                    return (
                      <button
                        type="button"
                        onClick={() => loadThreadForPeer(row.peerId)}
                        className={[
                          "group block w-full text-left px-4 py-3 rounded-md transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[#D3F501]",
                          active ? "bg-[#F7F8FA]" : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar} alt={name} className="h-11 w-11 object-cover ring-1 ring-slate-200" />
                          ) : (
                            <span
                              className="inline-flex h-11 w-11 items-center justify-center ring-1 ring-slate-200 bg-slate-100 text-slate-700 text-sm font-semibold"
                            >
                              {name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || row.peerId.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="truncate font-semibold text-[16px] leading-6 text-slate-900">
                                {name}
                              </p>
                              {unread > 0 && (
                                <span
                                  className="ml-2 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border-2"
                                  style={{ background: '#D3F501', color: '#111629', borderColor: '#000' }}
                                >
                                  {unread}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[12px] leading-5 text-slate-500 group-hover:text-slate-600">
                              {active ? "Open thread" : "Click to open the thread"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })()}
                </li>
              ))}
              {!filtered.length && (
                <li className="px-6 py-10 text-center text-sm text-slate-500">
                  No conversations yet. Use the form on the right to start one.
                </li>
              )}
            </ul>
          </aside>

          {/* Right pane: conditional thread view */}
          <section className="bg-white h-full flex flex-col">
            {!selectedPeerId ? (
              <div className="relative overflow-hidden border-b bg-white p-5 sm:p-7">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Messages</h1>
                <p className="text-slate-600 mt-1">Pick a conversation from the left to start chatting.</p>
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10" style={{ background: '#D3F501' }} />
              </div>
            ) : (
              <div className="border-b p-4">
                <h1 className="text-xl font-semibold">Chat</h1>
                <p className="text-sm text-slate-500">Talking with <span className="rounded bg-slate-100 px-2 py-0.5">{selectedPeerId.slice(0, 8)}…</span></p>
              </div>
            )}

            {error && (
              <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            {!selectedPeerId ? (
              <div className="m-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium">Start a conversation <span className="text-xs text-slate-400">(dev)</span></p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={peerIdInput}
                    onChange={(e) => setPeerIdInput(e.target.value)}
                    placeholder="Peer user UUID (e.g. 8b1e3e9e-...)"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-[14px] leading-6 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#D3F501]"
                  />
                  <button
                    onClick={async () => { await handleStartConversationDev(); if (peerIdInput.trim()) loadThreadForPeer(peerIdInput.trim()); }}
                    disabled={starting || !peerIdInput.trim()}
                    className="rounded-md px-4 py-2.5 text-[14px] font-semibold text-[#111629] disabled:opacity-50 transition-transform active:translate-y-px"
                    style={{ backgroundColor: '#D3F501', border: '2px solid #000' }}
                  >
                    {starting ? "Starting…" : "Start conversation"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Tip: open another browser as your other account.</p>
              </div>
            ) : (
              <>
                <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                  {loadingThread && <p className="text-center text-sm text-slate-500">Loading…</p>}
                  {msgs.map((m) => {
                    const myId = me?.id ?? "";
                    const mine = m.sender_id === myId;
                    return (
                      <div key={m.id} className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-lg border px-3 py-2 text-sm shadow-sm ${mine ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                          <div>{m.content}</div>
                          <div className="mt-1 text-[10px] text-slate-400">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    );
                  })}
                  {!loadingThread && !msgs.length && (
                    <p className="text-center text-sm text-slate-500">Say salaam to start the conversation.</p>
                  )}
                </div>
                <div className="flex items-center gap-2 border-t p-3">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message…"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-[14px] leading-6 focus:outline-none focus:ring-2 focus:ring-[#D3F501] focus:border-[#D3F501]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className="rounded-md px-4 py-2.5 text-[14px] font-semibold text-[#111629] disabled:opacity-50 transition-transform active:translate-y-px"
                    style={{ backgroundColor: '#D3F501', border: '2px solid #000' }}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </MessagesShell>
    </Shell>
  );
}