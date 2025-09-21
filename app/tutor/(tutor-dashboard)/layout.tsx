import type { ReactNode } from "react";
import DashboardShell from "@shells/DashboardShell";

export default function TutorLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      role="tutor"
    >
      {children}
    </DashboardShell>
  );
}
