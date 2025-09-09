import type { ReactNode } from "react";
import DashboardShell from "@shells/DashboardShell";

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
