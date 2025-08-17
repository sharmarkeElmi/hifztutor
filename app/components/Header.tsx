// app/components/Header.tsx
"use client";

/**
 * Public Header (signed-out navigation)
 * Shown on marketing/auth pages only.
 * Hidden on /student, /tutor, /lesson, /inbox via HeaderSwitcher.
 */

import Link from "next/link";

const BRAND = {
  deep: "#0B2526",    // deep green (brand)
  yellow: "#F7D949",  // brand yellow (primary CTA)
  accent: "#167584",  // accent teal/green (secondary button)
};

export default function Header() {
  return (
    <header className="border-b border-slate-200/60 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        {/* Logo */}
        <Link href="/landing" className="flex items-center gap-3">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg shadow-sm ring-1 ring-slate-900/10"
            style={{ backgroundColor: BRAND.yellow }}
            aria-hidden
          >
            {/* Placeholder mark — swap with your SVG when ready */}
            <span className="text-[10px] font-bold text-slate-900">▮▮</span>
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            HifzTutor
          </span>
        </Link>

        {/* Right-side nav */}
        <div className="flex items-center gap-3">
          {/* Subtle secondary button: Find a HifzTutor */}
          <Link
            href="/tutors"
            className="rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ color: BRAND.accent, borderColor: BRAND.accent }}
          >
            Find a HifzTutor
          </Link>

          {/* Link: Become a HifzTutor */}
          <Link
            href="/teach"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Become a HifzTutor
          </Link>

          {/* Sign in */}
          <Link
            href="/student/signin"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign in
          </Link>

          {/* Primary CTA: Get started */}
          <Link
            href="/student/signup"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-900 hover:opacity-95"
            style={{ backgroundColor: BRAND.yellow }}
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}