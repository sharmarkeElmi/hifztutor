import type { ReactNode } from "react";
import { getUnreadCountsForUser } from "@/lib/messages";
import MessagesLayoutClient from "./layout.client";

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const initialUnreadCounts = await getUnreadCountsForUser();
  return (
    <MessagesLayoutClient initialUnreadCounts={initialUnreadCounts}>
      {children}
    </MessagesLayoutClient>
  );
}
