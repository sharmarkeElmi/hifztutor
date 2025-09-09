export type Role = "student" | "tutor";

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  created_at?: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  avatar_url: string | null;
  email?: string | null;
};

export type ConversationMember = {
  conversation_id: string;
  user_id?: string;
  last_read_at: string | null;
};

