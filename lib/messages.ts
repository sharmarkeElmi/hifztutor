import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Conversation, Message, Profile, ConversationMember } from "@/lib/types/messages";

// Produce a canonical ordered pair so (a,b) and (b,a) map to the same row
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Resolve or create a conversation id between viewer and peer.
// Ensures a UNIQUE (user_a, user_b) works by using the ordered pair.
export async function getOrCreateConversationId(
  supabase: SupabaseClient,
  myId: string,
  peerId: string
): Promise<string | null> {
  const [a, b] = canonicalPair(myId, peerId);

  // Try upsert against ordered pair
  const { data: upserted, error: upErr } = await supabase
    .from("conversations")
    .upsert({ user_a: a, user_b: b }, { onConflict: "user_a,user_b" })
    .select("id")
    .single();

  if (upErr) {
    // Fallback: fetch existing with either ordering (handles legacy rows)
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`)
      .maybeSingle();
    return existing?.id ?? null;
  }

  return upserted?.id ?? null;
}

// Best-effort membership ensure; ignores unique violations
export async function ensureMembership(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversationId, user_id: userId });
  if (error && error.code !== "23505") {
    // Log but do not throw to avoid derailing UX
    console.warn("ensureMembership failed", error);
  }
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

