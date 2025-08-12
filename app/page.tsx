// app/page.tsx
// =====================
// Root route redirect
// Sends users from "/" to "/landing"
// so our renamed landing page is the default entry.
// =====================

import { redirect } from "next/navigation";

export default function RootRedirect() {
  redirect("/landing");
}