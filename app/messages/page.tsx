/* app/messages/page.tsx */
"use client";

/**
 * Messages — Inbox (MVP, members-based)
 * ------------------------------------------------------------
 * - Auth guard
 * - Renders INSIDE the dashboard Shell (so sidebar stays visible)
 * - Lists conversations; we now read peer from conversations.user_a/user_b
 *   to avoid relying on seeing the other member row.
 * - Clicking a row navigates to /messages/[peerId]
 * - Dev helper uses PEER UUID (not email)
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Shell from "../components/dashboard/Shell";
import type { PostgrestError } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

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

  // Dev helper: start a conversation by the other user's UUID
  const [peerIdInput, setPeerIdInput] = useState("");
  const [starting, setStarting] = useState(false);

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

  // Helper to detect Supabase unique constraint violations without using `any`
  const isUniqueViolation = (e: PostgrestError | null | undefined): boolean => {
    return e?.code === "23505";
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

      // 5) Navigate using the actual peer id (the one that's NOT me)
      const peerId = raw;
      window.location.assign(`/messages/${peerId}`);
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
    <Shell role={role}>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-slate-500">
            View your conversations and continue where you left off.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Dev helper: start a conversation (by peer UUID) */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium">Start a conversation (dev)</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={peerIdInput}
              onChange={(e) => setPeerIdInput(e.target.value)}
              placeholder="Peer user UUID (e.g. 8b1e3e9e-...)"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              onClick={handleStartConversationDev}
              disabled={starting || !peerIdInput.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Tip: open another browser as your other account, copy their UUID from the console we’ll show on /messages/[peerId] (or add a lightweight picker later).
          </p>
        </div>

        {/* Conversation list */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Your conversations</h2>
          </div>

          <ul className="divide-y">
            {list.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/messages/${row.peerId}`}
                  className="block px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        Conversation
                        <span className="ml-2 text-xs text-slate-400">
                          #{row.id.slice(0, 8)}…
                        </span>
                      </p>
                      {unreadMap[row.id] > 0 && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-yellow-400/90 px-2 py-0.5 text-xs font-semibold text-slate-900">
                          {unreadMap[row.id]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {row.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">Click to open the thread</p>
                </Link>
              </li>
            ))}
            {!list.length && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No conversations yet. Use the form above to start one.
              </li>
            )}
          </ul>
        </div>
      </section>
    </Shell>
  );
}