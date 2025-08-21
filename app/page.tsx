// app/page.tsx
// Root redirect "/" -> "/landing"
import { redirect } from "next/navigation";

export default function RootRedirect() {
  redirect("/landing");
}