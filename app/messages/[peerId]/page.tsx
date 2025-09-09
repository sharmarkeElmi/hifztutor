"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Shell from "../../components/dashboard/Shell";
import MessagesShell from "../../components/messages/MessagesShell";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

// Mark a conversation as read for the current user (throttled) and broadcast to other pages
const READ_THROTTLE_MS = 2000;
const lastReadMark: Record<string, number> = {};

async function markConversationRead(supabase: SupabaseClient, conversationId: string, myId: string) {
  const now = Date.now();
  const key = `${conversationId}:${myId}`;
  if (lastReadMark[key] && now - lastReadMark[key] < READ_THROTTLE_MS) {
    return;
  }
  lastReadMark[key] = now;

  try {
    const { error } = await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", myId)
      .select("conversation_id")
      .maybeSingle();

    if (error) {
      console.warn("markConversationRead failed:", error);
      return;
    }

    // Broadcast a lightweight "read" hint so list pages can refetch immediately (storage events fire cross-tab)
    try {
      const payload = { conversationId, userId: myId, at: new Date().toISOString() };
      // Write to a volatile key so 'storage' event is triggered
      localStorage.setItem("__hifztutor_conv_read__", JSON.stringify(payload));
      // Immediately clear it to avoid stale values
      localStorage.removeItem("__hifztutor_conv_read__");
    } catch {
      // ignore storage quota/SSR issues
    }
  } catch (e) {
    console.warn("markConversationRead failed:", e);
  }
}

type Role = "student" | "tutor";
type Conversation = { id: string; user_a: string; user_b: string };
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;           // ← use `content`
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const peerId = (params?.peerId as string) ?? "";

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [role, setRole] = useState<Role>("student");
  const [peerProfile, setPeerProfile] = useState<Profile | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const searchParams = useSearchParams();
  const filter = (searchParams?.get("filter") as "all" | "unread" | "archived") ?? "all";

  const scrollToBottom = useCallback(() => {
    if (!listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const channels: RealtimeChannel[] = [];

    (async () => {
      try {
        // Auth
        const { data: s } = await supabase.auth.getSession();
        const session = s?.session;
        if (!session) {
          router.replace("/student/signin");
          return;
        }
        const myId = session.user.id;
        const myEmail = session.user.email ?? null;
        if (!mounted) return;
        setMe({ id: myId, email: myEmail });

        // Role for Shell
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", myId)
          .maybeSingle();
        setRole(profile?.role === "tutor" ? "tutor" : "student");

        if (!peerId || typeof peerId !== "string") {
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // Canonical pair (a<b)
        const [a, b] = myId < peerId ? [myId, peerId] : [peerId, myId];

        // Resolve or create conversation
        const { data: upserted, error: upErr } = await supabase
          .from("conversations")
          .upsert({ user_a: a, user_b: b }, { onConflict: "user_a,user_b" })
          .select("id,user_a,user_b")
          .single();

        let conversation: Conversation | null = upserted ?? null;

        if (upErr) {
          const { data: fetched } = await supabase
            .from("conversations")
            .select("id,user_a,user_b")
            .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`)
            .maybeSingle();
          conversation = (fetched as Conversation) ?? null;
          if (!conversation) {
            if (!mounted) setLoading(false);
            return;
          }
        }

        if (!mounted || !conversation) return;
        setConv(conversation);

        // Load peer profile for header/name/avatar
        try {
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, full_name, display_name, avatar_url, email")
            .eq("id", peerId)
            .maybeSingle();
          if (mounted) setPeerProfile((pData as Profile) ?? null);
        } catch {
          if (mounted) setPeerProfile(null);
        }

        // Ensure membership exists (ignore duplicates)
        const { error: memErr } = await supabase
          .from("conversation_members")
          .insert({ conversation_id: conversation.id, user_id: myId })
          .select("conversation_id")
          .maybeSingle();
        if (memErr && memErr.code !== "23505") console.warn("member insert error:", memErr);

        // Load existing messages (either ordering)
        const findBothConversations = async (a: string, b: string, fallbackId: string) => {
          const { data: convRows, error } = await supabase
            .from("conversations")
            .select("id,user_a,user_b")
            .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`);
          if (error) return [fallbackId];
          const ids = (convRows ?? []).map((r) => r.id);
          if (!ids.includes(fallbackId)) ids.push(fallbackId);
          return Array.from(new Set(ids));
        };

        const convIds = await findBothConversations(a, b, conversation.id);

        const { data: initialMsgs, error: mErr } = await supabase
          .from("messages")
          .select("id,conversation_id,sender_id,content,created_at")  // ← select `content`
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true });

        if (mErr) {
          if (!mounted) return;
          setMsgs([]);
          setLoading(false);
        } else {
          if (!mounted) return;
          setMsgs((initialMsgs ?? []) as Message[]);
          setLoading(false);
          scrollToBottom();
        }

        // Stamp 'read' when we land on the thread
        if (conversation?.id && myId) {
          markConversationRead(supabase, conversation.id, myId);
        }

        // Realtime for each conv id
        for (const id of convIds) {
          const ch = supabase
            .channel(`conv-${id}`)
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
              (payload) => {
                const newMsg = payload.new as Message; // will include `content`
                setMsgs((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
                scrollToBottom();

                // If a peer sent a new message while we're viewing the thread, mark as read
                if (
                  newMsg?.sender_id &&
                  myId &&
                  newMsg.sender_id !== myId &&
                  conversation?.id &&
                  document.visibilityState === "visible"
                ) {
                  queueMicrotask(() => markConversationRead(supabase, conversation.id, myId));
                }
              }
            )
            .subscribe();
          channels.push(ch);
        }
      } catch (err) {
        console.error("ThreadPage boot error:", err);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [peerId, supabase, scrollToBottom, router]);

// Mark as read when the tab/window gains focus
useEffect(() => {
  if (typeof window === "undefined") return;
  if (!conv?.id || !me?.id) return;

  const onFocus = () => markConversationRead(supabase, conv.id, me.id);
  window.addEventListener("focus", onFocus);
  return () => window.removeEventListener("focus", onFocus);
}, [conv?.id, me?.id, supabase]);

// Also mark as read when the tab becomes visible (e.g., after switching tabs)
useEffect(() => {
  if (typeof document === "undefined") return;
  if (!conv?.id || !me?.id) return;
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      markConversationRead(supabase, conv.id, me.id);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [conv?.id, me?.id, supabase]);

  const canSend = useMemo(
    () => text.trim().length > 0 && !!conv && !!me && !sending,
    [text, conv, me, sending]
  );

  const handleSend = async () => {
    if (!canSend || !conv || !me) return;
    const content = text.trim();   // ← use `content`
    if (!content) return;

    setSending(true);
    setText("");

    // optimistic
    const temp: Message = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conv.id,
      sender_id: me.id,
      content,                   // ← use `content`
      created_at: new Date().toISOString(),
    };
    setMsgs((prev) => [...prev, temp]);
    scrollToBottom();

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, sender_id: me.id, content }) // ← insert `content`
      .select("id,conversation_id,sender_id,content,created_at")        // ← select `content`
      .single();

    if (error) {
      setMsgs((prev) => prev.filter((m) => m.id !== temp.id));
      alert(error.message ?? "Failed to send");
    } else if (data) {
      setMsgs((prev) => prev.map((m) => (m.id === temp.id ? (data as Message) : m)));
    }

    setSending(false);
    scrollToBottom();
  };

  if (loading) return <p className="p-6 text-center">Loading conversation…</p>;
  if (!me) return null;

  const chatWithId = conv && me ? (conv.user_a === me.id ? conv.user_b : conv.user_a) : peerId;

  const peerDisplayName =
    peerProfile?.display_name?.trim() ||
    peerProfile?.full_name?.trim() ||
    peerProfile?.email ||
    String(chatWithId).slice(0, 8);

  return (
    <Shell role={role}>
      <MessagesShell activeKey={filter}>
        <div
          className="w-full grid grid-cols-1 items-stretch md:grid-cols-[var(--inbox-sidebar-w,400px)_minmax(0,1fr)] md:divide-x md:divide-slate-200 gap-0 overflow-hidden"
        >
          {/* Left: conversation rail (simple version; links back to inbox and shows current peer) */}
          <aside className="bg-white h-full overflow-y-auto" style={{ width: "var(--inbox-sidebar-w, 400px)" }}>
            <div className="p-3">
              <h2 className="px-2 pb-2 text-[15px] font-semibold text-slate-700">Conversations</h2>
              <div className="divide-y divide-slate-100">
                <Link
                  href={`/messages${filter === "all" ? "" : `?filter=${filter}`}`}
                  className="flex items-center gap-3 px-2 py-3 hover:bg-slate-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700">🏠</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-slate-900">All conversations</p>
                    <p className="truncate text-[13px] text-slate-600">Back to inbox</p>
                  </div>
                </Link>

                <Link
                  href={`/messages/${chatWithId}${filter === "all" ? "" : `?filter=${filter}`}`}
                  className="flex items-center gap-3 px-2 py-3 bg-slate-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700">{String(chatWithId).slice(0,2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#111629]">Current chat</p>
                    <p className="truncate text-[13px] text-slate-600">Selected</p>
                  </div>
                </Link>
              </div>
            </div>
          </aside>

          {/* Right: thread pane */}
          <section className="bg-white h-full flex flex-col">
            {/* Sticky chat header */}
            <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur p-3 sm:p-4">
              <div className="flex items-center gap-3">
                {peerProfile?.avatar_url ? (
                  <Image
                    src={peerProfile.avatar_url}
                    alt={peerDisplayName}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 rounded-md object-cover border"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-slate-100 border grid place-items-center text-sm font-semibold text-slate-700">
                    {String(peerDisplayName).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold text-[#111629] truncate">{peerDisplayName}</h1>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">Private conversation</p>
                </div>
              </div>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {msgs.map((m, idx) => {
                const mine = m.sender_id === me.id;
                // Show sender label when the sender changes from previous message
                const prev = msgs[idx - 1];
                const changedSender = !prev || prev.sender_id !== m.sender_id;
                const senderLabel = mine ? "You" : peerDisplayName;
                return (
                  <div key={m.id} className={`mb-3 ${mine ? "pl-16 pr-2" : "pr-16 pl-2"}`}>
                    {changedSender && (
                      <div className={`mb-1 text-xs ${mine ? "text-right" : "text-left"} text-slate-500`}>
                        {senderLabel}
                      </div>
                    )}
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl border px-3 py-2 text-[15px] leading-relaxed shadow-sm ${
                          mine ? "bg-[#F2FFB6] border-[#D3F501]" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        <div className="mt-1 text-[10px] text-slate-400 text-right">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!msgs.length && (
                <p className="text-center text-sm text-slate-500">Say salaam to start the conversation.</p>
              )}
            </div>

            <div className="border-t p-3 sm:p-4">
              <div className="flex items-end gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Write a message…"
                  rows={1}
                  className="min-h-[40px] max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-relaxed outline-none placeholder:text-slate-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="grid h-10 w-10 place-items-center rounded-lg border border-[#111629] bg-[#111629] hover:bg-black disabled:opacity-40"
                >
                  <Image src="/send-button-icon.svg" alt="" width={20} height={20} className="h-5 w-5 invert" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </MessagesShell>
    </Shell>
  );
}