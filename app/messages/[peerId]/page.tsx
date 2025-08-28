"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "../../components/dashboard/Shell";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
const supabase = createClientComponentClient();

// Mark a conversation as read for the current user (throttled) and broadcast to other pages
const READ_THROTTLE_MS = 2000;
const lastReadMark: Record<string, number> = {};

async function markConversationRead(conversationId: string, myId: string) {
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

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams<{ peerId: string }>();
  const peerId = params?.peerId ?? "";

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [role, setRole] = useState<Role>("student");
  const [conv, setConv] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  useEffect(() => {
    let mounted = true;
    const channels: ReturnType<typeof supabase.channel>[] = [];

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
          markConversationRead(conversation.id, myId);
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
                  queueMicrotask(() => markConversationRead(conversation.id, myId));
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
  }, [peerId, router]);

// Mark as read when the tab/window gains focus
useEffect(() => {
  if (!conv?.id || !me?.id) return;

  const onFocus = () => markConversationRead(conv.id, me.id);
  window.addEventListener("focus", onFocus);
  return () => window.removeEventListener("focus", onFocus);
}, [conv?.id, me?.id]);

// Also mark as read when the tab becomes visible (e.g., after switching tabs)
useEffect(() => {
  if (!conv?.id || !me?.id) return;
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      markConversationRead(conv.id, me.id);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [conv?.id, me?.id]);

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

  return (
    <Shell role={role}>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-slate-500">
            Chat with user: <span className="rounded bg-slate-100 px-2 py-0.5">{chatWithId}</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div ref={listRef} className="h-[60vh] overflow-y-auto px-4 py-4">
            {msgs.map((m) => {
              const mine = m.sender_id === me.id;
              return (
                <div key={m.id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg border px-3 py-2 text-sm shadow-sm ${
                      mine ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>{m.content}</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            {!msgs.length && (
              <p className="text-center text-sm text-slate-500">Say salaam to start the conversation.</p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message…"
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </section>
    </Shell>
  );
}