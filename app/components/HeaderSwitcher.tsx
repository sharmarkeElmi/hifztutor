// app/components/HeaderSwitcher.tsx
"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Header from "./Header";

/**
 * Shows the public Header on marketing/auth pages.
 * Hides it on app areas that use the dashboard shell.
 */
export default function HeaderSwitcher({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const appPrefixes = ["/student", "/tutor", "/lesson", "/inbox", "/messages"];
  const authPages = ["/signin", "/student/signup", "/tutor/signup"]; // auth flows still use public header but custom layout
  const isAppArea = appPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = authPages.includes(pathname);

  if (isAppArea) {
    // Dashboard / live room: no public header, no container
    return <>{children}</>;
  }

  if (isAuthPage) {
    return (
      <>
        <Header />
        <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-white">{children}</main>
      </>
    );
  }

  // Public / marketing pages
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </>
  );
}
