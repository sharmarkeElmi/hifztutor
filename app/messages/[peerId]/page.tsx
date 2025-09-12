"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@components/ui/button";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { markConversationRead, getOrCreateConversationId, ensureMembership } from "@/lib/messages";
import type { Conversation, Message, Profile } from "@/lib/types/messages";
import type { RealtimeChannel } from "@supabase/supabase-js";

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const peerId = (params?.peerId as string) ?? "";

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [peerProfile, setPeerProfile] = useState<Profile | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

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

        if (!peerId || typeof peerId !== "string") {
          if (!mounted) return;
          setLoading(false);
          return;
        }

        // Resolve or create conversation
        const convId = await getOrCreateConversationId(supabase, myId, peerId);
        if (!convId) {
          if (mounted) setLoading(false);
          return;
        }
        const { data: convRow } = await supabase
          .from("conversations")
          .select("id,user_a,user_b")
          .eq("id", convId)
          .single();
        const conversation = (convRow as Conversation) ?? null;

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
        await ensureMembership(supabase, conversation.id, myId);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conv?.id || !me?.id) return;
    const onFocus = () => markConversationRead(supabase, conv.id, me.id);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [conv?.id, me?.id, supabase]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!conv?.id || !me?.id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") markConversationRead(supabase, conv.id, me.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conv?.id, me?.id, supabase]);

  const canSend = useMemo(() => text.trim().length > 0 && !!conv && !!me && !sending, [text, conv, me, sending]);

  const handleSend = async () => {
    if (!canSend || !conv || !me) return;
    const content = text.trim();
    if (!content) return;

    setSending(true);
    setText("");

    const temp: Message = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conv.id,
      sender_id: me.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMsgs((prev) => [...prev, temp]);
    scrollToBottom();

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, sender_id: me.id, content })
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

  const peerDisplayName =
    peerProfile?.display_name?.trim() || peerProfile?.full_name?.trim() || peerProfile?.email || String(peerId).slice(0, 8);

  return (
    <>
      {/* Sticky chat header */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur p-3 sm:p-4 -mt-px">
        <div className="flex items-center gap-3">
          {peerProfile?.avatar_url ? (
            <Image src={peerProfile.avatar_url} alt={peerDisplayName} width={40} height={40} unoptimized className="h-10 w-10 rounded-md object-cover border" />
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

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {msgs.map((m, idx) => {
          const mine = m.sender_id === (me?.id ?? "");
          const prev = msgs[idx - 1];
          const changedSender = !prev || prev.sender_id !== m.sender_id;
          const senderLabel = mine ? "You" : peerDisplayName;
          return (
            <div key={m.id} className={`mb-3 ${mine ? "pl-16 pr-2" : "pr-16 pl-2"}`}>
              {changedSender && (
                <div className={`mb-1 text-xs ${mine ? "text-right" : "text-left"} text-slate-500`}>{senderLabel}</div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] sm:max-w-[66%] rounded-2xl border px-3 py-2 text-[15px] leading-relaxed shadow-sm ${
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
        {!msgs.length && <p className="text-center text-sm text-slate-500">Say salaam to start the conversation.</p>}
      </div>

      {/* Composer */}
      <div className="border-t p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm">
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
            className="min-h-[44px] max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-relaxed outline-none placeholder:text-slate-400"
          />
          <Button onClick={handleSend} disabled={!canSend} aria-label="Send message" size="icon" variant="default" className="!bg-[#D3F501] !border-black hover:!bg-lime-400">
            <Image src="/send-button-icon.svg" alt="" width={20} height={20} className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );
}
