import type { ReactNode } from "react";
import DashboardShell from "@/app/components/dashboard/Shell";

export default function TutorLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      role="tutor"
      unreadTotal={0} // TODO: wire to real unread count
    >
      {children}
    </DashboardShell>
  );
}