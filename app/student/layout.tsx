import type { ReactNode } from "react";
import DashboardShell from "@/app/components/dashboard/Shell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      role="student"
      unreadTotal={0} // TODO: connect real unread count
    >
      {children}
    </DashboardShell>
  );
}