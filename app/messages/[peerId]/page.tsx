"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@components/ui/button";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getOrCreateConversationId, ensureMembership, READ_STATE_EVENT } from "@/lib/messages";
import type { Conversation, Message, Profile } from "@/lib/types/messages";
import type { RealtimeChannel } from "@supabase/supabase-js";

declare global {
  interface Window {
    conv?: Conversation | null;
    convId?: string | null;
    me?: { id: string; email: string | null } | null;
  }
}

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const peerId = (params?.peerId as string) ?? "";

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [peerProfile, setPeerProfile] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const [convId, setConvId] = useState<string | null>(null);

  // Debounced read-stamp to avoid spamming updates
  const debouncedMarkRead = useMemo(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (conversationId: string, userId: string) => {
      if (!conversationId || !userId) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const doStamp = async (attempt = 1) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[mark-read] stamping', { conversationId, attempt });
          }
          try {
            const res = await fetch('/api/messages/mark-read', {
              method: 'POST',
              cache: 'no-store',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId }),
            });
            const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (res.status === 404 && attempt === 1) {
              // Ensure membership for current user then retry once
              await ensureMembership(supabase, conversationId, userId);
              return doStamp(2);
            }
            if (!res.ok || !j?.ok) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[mark-read] failed', j?.error || res.statusText);
              }
              return;
            }
            if (process.env.NODE_ENV !== 'production') {
              console.log('[mark-read] stamped ok');
            }
            // Notify listeners to refresh unread badges immediately
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event(READ_STATE_EVENT));
            }
          } catch {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[mark-read] network error');
            }
          }
        };
        void doStamp();
      }, 300);
    };
  }, [supabase]);

  // Expose for Safari console debugging
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.conv = conv;
      window.convId = convId;
      window.me = me;
    }
  }, [conv, convId, me]);

  // filter from URL is not needed for thread rendering here; layout handles tabs/inbox

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

        // Optional: role could be used for analytics or further logic; omitted from UI here

        // Load my profile (name/avatar) for display in message cards
        try {
          const { data: meProf } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", myId)
            .maybeSingle();
          if (mounted) setMyProfile((meProf as Profile) ?? null);
        } catch {
          if (mounted) setMyProfile(null);
        }

        if (!peerId || typeof peerId !== "string") {
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // Resolve or create conversation
        const createdId = await getOrCreateConversationId(supabase, myId, peerId);
        console.log("[thread] getOrCreateConversationId →", createdId);
        if (!createdId) {
          if (mounted) setLoading(false);
          return;
        }
        if (mounted) setConvId(createdId);

        const { data: convRow } = await supabase
          .from("conversations")
          .select("id,user_a,user_b")
          .eq("id", createdId)
          .single();
        const conversation = (convRow as Conversation) ?? null;

        if (!mounted || !conversation) return;
        setConv(conversation);

        // Load peer profile for header/name/avatar
        try {
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", peerId)
            .maybeSingle();
          if (mounted) setPeerProfile((pData as Profile) ?? null);
        } catch {
          if (mounted) setPeerProfile(null);
        }

        // Ensure my membership exists (receiver will ensure theirs on view)
        await ensureMembership(supabase, createdId, myId);
        if (process.env.NODE_ENV !== 'production') {
          console.log('[thread] membership ensured for', myId, '→', createdId);
        }

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

        const [a, b] = myId < peerId ? [myId, peerId] : [peerId, myId];
        const convIds = await findBothConversations(a, b, conversation.id);

        const { data: initialMsgs, error: mErr } = await supabase
          .from("messages")
          .select("id,conversation_id,sender_id,content,created_at")
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
          debouncedMarkRead(conversation.id, myId);
        }

        // Realtime for each conv id
        for (const id of convIds) {
          const ch = supabase
            .channel(`conv-${id}`)
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
              (payload) => {
                const newMsg = payload.new as Message;
                setMsgs((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
                scrollToBottom();

                if (
                  newMsg?.sender_id &&
                  myId &&
                  newMsg.sender_id !== myId &&
                  conversation?.id &&
                  document.visibilityState === "visible"
                ) {
                  queueMicrotask(() => debouncedMarkRead(conversation.id, myId));
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
  }, [peerId, supabase, scrollToBottom, router, debouncedMarkRead]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conv?.id || !me?.id) return;
    const onFocus = () => debouncedMarkRead(conv.id, me.id);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [conv?.id, me?.id, supabase, debouncedMarkRead]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!conv?.id || !me?.id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") debouncedMarkRead(conv.id, me.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conv?.id, me?.id, supabase, debouncedMarkRead]);

  const canSend = useMemo(() => text.trim().length > 0 && !!convId && !!me && !sending, [text, convId, me, sending]);

  const handleSend = async () => {
    console.log("[send] canSend=", canSend, "convId=", convId, "me=", me?.id, "len=", text.trim().length);
    if (!canSend || !convId || !me) return;
    const content = text.trim();
    if (!content) return;

    setSending(true);
    setText("");

    const temp: Message = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: convId,
      sender_id: me.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMsgs((prev) => [...prev, temp]);
    scrollToBottom();

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: me.id, content })
      .select("id,conversation_id,sender_id,content,created_at")
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

  const peerDisplayName = (() => {
    const full = peerProfile?.full_name?.trim();
    const shortId = String(peerId).slice(0, 8);
    return full || shortId;
  })();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sticky chat header */}
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="h-16 flex items-center px-4 sm:px-6">
          <h1 className="truncate text-[18px] sm:text-[20px] font-extrabold tracking-tight text-[#111629]">
            {peerDisplayName}
          </h1>
        </div>
      </div>

      {/* Messages list */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 sm:px-6 sm:pt-6 pb-3">
        {msgs.map((m, idx) => {
          const mine = m.sender_id === (me?.id ?? "");
          const prev = msgs[idx - 1];
          const prevDay = prev ? new Date(prev.created_at).toDateString() : null;
          const thisDay = new Date(m.created_at).toDateString();
          const showDate = !prev || prevDay !== thisDay;
          const timeLabel = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const dateLabel = new Date(m.created_at).toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });

          // Avatar and display name
          const avatarUrl = mine ? null : (peerProfile?.avatar_url ?? null);
          const displayName = mine
            ? (myProfile?.full_name?.trim() || me?.email || 'You')
            : (peerProfile?.full_name?.trim() || peerDisplayName);

          return (
            <div key={m.id} className="mb-3 sm:mb-4">
              {showDate && (
                <div className="my-4 flex items-center justify-center">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                    {dateLabel}
                  </span>
                </div>
              )}

              <div className="flex">
                {/* Message card with avatar + sender inside */}
                <div className="flex-1">
                  <div className="bg-white hover:bg-slate-100 transition-colors p-3 sm:p-4">
                    <div className="grid grid-cols-[36px_1fr] gap-3 items-center">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-md overflow-hidden border bg-slate-100 grid place-items-center shrink-0 self-center">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt={displayName} width={36} height={36} className="h-9 w-9 object-cover" />
                        ) : (
                          <span className="text-[12px] font-semibold text-slate-600">
                            {String(displayName).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || '•'}
                          </span>
                        )}
                      </div>
                      {/* Name + time */}
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[14px] font-semibold text-[#111629] leading-none truncate">
                          {displayName}
                        </span>
                        <span className="text-[12px] text-slate-500 leading-none">{timeLabel}</span>
                      </div>
                      {/* Content aligned under name */}
                      <div className="col-start-2 text-[15px] leading-relaxed text-[#111629] whitespace-pre-wrap break-words">
                        {m.content}
                      </div>
                      {mine && (
                        <div className="col-start-2 mt-1 text-[12px] text-slate-400">Sent</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!msgs.length && <p className="text-center text-sm text-slate-500">Say salaam to start the conversation.</p>}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 z-10 bg-white p-4 sm:p-6 pb-[env(safe-area-inset-bottom)] mb-2 md:mb-0">
        <div className="flex items-center gap-3 rounded-xl border-2 !border-black bg-white px-3 py-3 mt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Your message"
            rows={1}
            className="h-12 max-h-40 flex-1 resize-none bg-transparent px-2 py-0 text-[15px] leading-normal outline-none placeholder:text-slate-400"
          />
          <Button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            size="icon"
            variant="secondary"
            className={`h-12 w-12 disabled:opacity-60 focus-visible:ring-2 ${
              canSend
                ? '!bg-[#D3F501] !text-black hover:opacity-95 focus-visible:ring-[#D3F501]'
                : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
            }`}
          >
            <Image src="/send-button-icon.svg" alt="" width={24} height={24} className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
