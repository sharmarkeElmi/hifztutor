import { z } from "zod";

// Basic schemas for message feature
export const MessageInputSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(4000),
});
export type MessageInput = z.infer<typeof MessageInputSchema>;

export const StartConversationSchema = z.object({
  peerId: z.string().uuid(),
});
export type StartConversationInput = z.infer<typeof StartConversationSchema>;

