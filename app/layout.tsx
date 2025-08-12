// app/layout.tsx
// =====================
// GLOBAL APP LAYOUT (App Router)
// - Loads global CSS and fonts
// - Defines <head> metadata
// - Renders a shared header/nav and a main content area
// - Wraps every route under /app
// =====================

import "./globals.css";                      // Global styles for the entire app
import type { Metadata } from "next";        // Metadata type for <head> config
import { Inter } from "next/font/google";    // Google font helper (automatic optimization)
import Link from "next/link";                // Client-side navigation between routes

// =====================
// FONT SETUP
// =====================
const inter = Inter({ subsets: ["latin"] });

// =====================
// <head> METADATA
// Shown in the browser tab, used for SEO/social cards.
// (Can be overridden per page if needed.)
// =====================
export const metadata: Metadata = {
  title: "HifzTutor",
  description: "Find trusted Hifz tutors and book live lessons",
};

// =====================
// ROOT LAYOUT
// - Receives `children` (the active route's content) from Next.js
// - Applies a global header and container layout
// =====================
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Apply the Inter font to the whole document */}
      <body className={inter.className}>
        {/* =====================
            GLOBAL HEADER / NAV
            - Visible on all pages
            - Brand link goes to /landing (we renamed the homepage)
            - Student links go to /student/... per our new structure
           ===================== */}
        <header className="border-b">
          <nav
            className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"
            aria-label="Global"
          >
            {/* Brand / goes to the new landing page */}
            <Link href="/landing" className="text-xl font-semibold">
              HifzTutor
            </Link>

            {/* Student-first links (we’ll add tutor shortcuts later if you want) */}
            <div className="flex items-center gap-4">
              {/* Student dashboard */}
              <Link href="/student/dashboard" className="hover:underline">
                Dashboard
              </Link>

              {/* Student auth */}
              <Link
                href="/student/signin"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Sign in
              </Link>
              <Link
                href="/student/signup"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Sign up
              </Link>

              {/*
        Optional: quick tutor links in the top nav.
        Uncomment if you want them visible globally.

        <Link
          href="/tutor/signin"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Tutor sign in
        </Link>
        <Link
          href="/tutor/signup"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Tutor sign up
        </Link>
      */}
            </div>
          </nav>
        </header>

        {/* =====================
            MAIN CONTENT WRAPPER
            - Centers content and adds consistent padding
            - Renders the active route via `children`
           ===================== */}
        <main className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}