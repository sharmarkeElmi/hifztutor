import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Message, Profile, ConversationMember } from "@/lib/types/messages";
import { createSupabaseBrowserClient } from "@/lib/supabase";

// Produce a canonical ordered pair so (a,b) and (b,a) map to the same row
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Resolve or create a conversation id between viewer and peer.
// Ensures a UNIQUE (user_a, user_b) works by using the ordered pair.
// Overloaded helper – can be used with a client (browser) or server-side without providing one.
export async function getOrCreateConversationId(a: string, b: string): Promise<string | null>;
export async function getOrCreateConversationId(
  supabase: SupabaseClient,
  a: string,
  b: string
): Promise<string | null>;
export async function getOrCreateConversationId(
  arg1: SupabaseClient | string,
  arg2?: string,
  arg3?: string
): Promise<string | null> {
  const hasClient = typeof arg1 !== "string";
  const supabase: SupabaseClient = hasClient
    ? (arg1 as SupabaseClient)
    : (typeof window !== "undefined"
        ? (createSupabaseBrowserClient() as SupabaseClient)
        : ((await getServerSupabase()) as unknown as SupabaseClient));

  const u1 = (hasClient ? (arg2 as string) : (arg1 as string))!;
  const u2 = (hasClient ? (arg3 as string) : (arg2 as string))!;
  const [user_a, user_b] = canonicalPair(u1, u2);

  // Try INSERT first; if duplicate (or any failure), fall back to SELECT
  const ins = await supabase
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (ins.data?.id) return ins.data.id;

  // Find existing in canonical order
  const sel1 = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (sel1.data?.id) return sel1.data.id;

  // Then try reversed order to support any legacy rows
  const sel2 = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_b)
    .eq("user_b", user_a)
    .maybeSingle();
  if (sel2.data?.id) return sel2.data.id;

  return null;
}

// Best-effort membership ensure; ignores unique violations
export async function ensureMembership(conversationId: string, userId: string): Promise<void>;
export async function ensureMembership(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<void>;
export async function ensureMembership(
  arg1: SupabaseClient | string,
  arg2?: string,
  arg3?: string
): Promise<void> {
  const hasClient = typeof arg1 !== "string";
  const supabase: SupabaseClient = hasClient
    ? (arg1 as SupabaseClient)
    : (typeof window !== "undefined"
        ? (createSupabaseBrowserClient() as SupabaseClient)
        : ((await getServerSupabase()) as unknown as SupabaseClient));
  const conversationId = (hasClient ? (arg2 as string) : (arg1 as string))!;
  const userId = (hasClient ? (arg3 as string) : (arg2 as string))!;

  // Try INSERT first; ignore duplicates by falling back to SELECT
  const ins = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversationId, user_id: userId })
    .select("conversation_id")
    .single();
  if (ins.data?.conversation_id) return;
  await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
}

// Ensure membership rows exist for both participants (idempotent)
export async function ensureBothMemberships(
  supabase: SupabaseClient,
  conversationId: string,
  userA: string,
  userB: string
): Promise<void> {
  await Promise.all([
    ensureMembership(supabase, conversationId, userA),
    ensureMembership(supabase, conversationId, userB),
  ]);
}

// Derive the peer id given a conversation row and the viewer id
export function computePeerIdForConversation(c: Conversation, viewerId: string): string {
  return c.user_a === viewerId ? c.user_b : c.user_a;
}

// Fetch a batch of peer profiles for display
export async function fetchPeerProfiles(
  supabase: SupabaseClient,
  peerIds: string[]
): Promise<Record<string, Profile>> {
  if (!peerIds.length) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url, email")
    .in("id", peerIds);
  const map: Record<string, Profile> = {};
  for (const row of data ?? []) {
    map[row.id] = {
      id: row.id,
      full_name: row.full_name ?? null,
      display_name: row.display_name ?? null,
      avatar_url: row.avatar_url ?? null,
      email: row.email ?? null,
    };
  }
  return map;
}

// Throttled mark-as-read with cross-tab broadcast via localStorage
const READ_THROTTLE_MS = 2000;
const lastReadMark: Record<string, number> = {};

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  myId: string
): Promise<void> {
  const now = Date.now();
  const key = `${conversationId}:${myId}`;
  if (lastReadMark[key] && now - lastReadMark[key] < READ_THROTTLE_MS) return;
  lastReadMark[key] = now;

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

  try {
    const payload = { conversationId, userId: myId, at: new Date().toISOString() };
    localStorage.setItem("__hifztutor_conv_read__", JSON.stringify(payload));
    localStorage.removeItem("__hifztutor_conv_read__");
    // Notify current tab listeners to refresh counts immediately
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(READ_STATE_EVENT));
    }
  } catch {
    // ignore storage issues (SSR/unavailable)
  }
}

// Load messages for a set of conversation IDs
export async function fetchMessagesForConversations(
  supabase: SupabaseClient,
  conversationIds: string[]
): Promise<Message[]> {
  if (!conversationIds.length) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id,conversation_id,sender_id,content,created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as Message[];
}

// Compute unread counts per conversation id for the viewer (current MVP performs one count per conversation)
export async function computeUnreadMap(
  supabase: SupabaseClient,
  viewerId: string,
  memberships: ConversationMember[],
  conversations: Conversation[]
): Promise<Record<string, number>> {
  const memberByConv = new Map(
    (memberships ?? []).map((m) => [m.conversation_id, m.last_read_at ?? "1970-01-01T00:00:00Z"])
  );

  const tasks = (conversations ?? []).map(async (c) => {
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
  return Object.fromEntries(results);
}

// ----------------------------------------------------------------------------
// New server helpers + tab filtering + event name
// ----------------------------------------------------------------------------


export const READ_STATE_EVENT = "messages:read-state-changed" as const;

// Lazily import server-only modules so this file stays client-safe.
export async function getServerSupabase() {
  const headersMod = await import("next/headers");
  const ssrMod = await import("@supabase/ssr");
  const cookieStore = await headersMod.cookies();
  return ssrMod.createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...(options ?? {}) });
          });
        },
      },
    }
  );
}

export type UnreadCounts = {
  totalUnread: number;
  perConversation: Record<string, number>;
};

export type UnreadCountsDebug = UnreadCounts & {
  memberships: Array<{ conversation_id: string; last_read_at: string | null }>;
  rawCounts: Record<string, number>;
};

// Computes per-conversation unread counts for the current user.
export async function getUnreadCountsForUser(): Promise<UnreadCounts> {
  try {
    const supabase = await getServerSupabase();
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return { totalUnread: 0, perConversation: {} };

    // Gather all conversations where the user participates
    const { data: convs } = await supabase
      .from("conversations")
      .select("id,user_a,user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const convIds = (convs ?? []).map((c) => c.id as string);
    if (convIds.length === 0) return { totalUnread: 0, perConversation: {} };

    // Load memberships only for those convs
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("user_id", user.id)
      .in("conversation_id", convIds);

    // Build effective last_read_at per conv (fallback to epoch for missing membership)
    const lastReadByConv = new Map<string, string | null>();
    (memberships ?? []).forEach((m) => lastReadByConv.set(m.conversation_id as string, m.last_read_at as string | null));

    const per: Record<string, number> = {};
    const tasks = convIds.map(async (cid) => {
      const lastRead = lastReadByConv.get(cid) ?? "1970-01-01T00:00:00Z";
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", cid)
        .neq("sender_id", user.id)
        .gt("created_at", lastRead);
      per[cid] = Number(count ?? 0);
    });
    await Promise.all(tasks);

    const totalUnread = Object.values(per).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return { totalUnread, perConversation: per };
  } catch {
    return { totalUnread: 0, perConversation: {} };
  }
}

// Debug variant that returns inputs used for counting
export async function getUnreadCountsForUserDebug(): Promise<UnreadCountsDebug> {
  try {
    const supabase = await getServerSupabase();
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return { totalUnread: 0, perConversation: {}, memberships: [], rawCounts: {} };

    const { data: convs } = await supabase
      .from("conversations")
      .select("id,user_a,user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const convIds = (convs ?? []).map((c) => c.id as string);

    const { data: membershipsRows } = await supabase
      .from("conversation_members")
      .select("conversation_id,last_read_at")
      .eq("user_id", user.id)
      .in("conversation_id", convIds.length ? convIds : ["00000000-0000-0000-0000-000000000000"]);

    const lastReadByConv = new Map<string, string | null>();
    (membershipsRows ?? []).forEach((m) => lastReadByConv.set(m.conversation_id as string, m.last_read_at as string | null));

    const rawCounts: Record<string, number> = {};
    await Promise.all(
      convIds.map(async (cid) => {
        const lastRead = lastReadByConv.get(cid) ?? "1970-01-01T00:00:00Z";
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", cid)
          .neq("sender_id", user.id)
          .gt("created_at", lastRead);
        rawCounts[cid] = Number(count ?? 0);
      })
    );

    const totalUnread = Object.values(rawCounts).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const perConversation = rawCounts;
    const effectiveMemberships = convIds.map((cid) => ({ conversation_id: cid, last_read_at: lastReadByConv.get(cid) ?? null }));
    return { totalUnread, perConversation, memberships: effectiveMemberships, rawCounts };
  } catch {
    return { totalUnread: 0, perConversation: {}, memberships: [], rawCounts: {} };
  }
}

export type MessagesTab = "all" | "unread" | "archived";

// Note: archived is not currently modelled; we return empty list for that tab.
export function filterConversationsByTab(
  conversations: Conversation[],
  tab: MessagesTab,
  unreadMap: Record<string, number>
): Conversation[] {
  if (tab === "unread") {
    return conversations.filter((c) => (unreadMap[c.id] ?? 0) > 0);
  }
  if (tab === "archived") {
    // Placeholder until an archived flag exists
    return [];
  }
  return conversations;
}
