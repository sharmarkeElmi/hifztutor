import type { ReactNode } from "react";
import DashboardShell from "@shells/DashboardShell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      role="student"
    >
      {children}
    </DashboardShell>
  );
}
