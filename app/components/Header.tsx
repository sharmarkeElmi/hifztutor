// app/components/Header.tsx
"use client";

/**
 * Public Header (signed-out navigation)
 * Shown on marketing/auth pages only.
 * Hidden on /student, /tutor, /lesson, /inbox via HeaderSwitcher.
 */

import Link from "next/link";
import Image from "next/image";
// NOTE: for SVGs we prefer a plain <img/> to render the vector exactly as-authored
// (no layout calculations or rasterisation from next/image are needed here).

const BRAND = {
  deep: "#111629",    // deep green (brand)
  yellow: "#F7D250",  // brand yellow (primary CTA)
  accent: "#D3F501",  // accent teal/green (secondary button)
};

export default function Header() {
  return (
    <header className="border-b border-slate-200/60 relative z-50">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        {/* Logo */}
        <Link href="/landing" aria-label="HifzTutor home" className="flex items-center gap-3">
          {/* Full wordmark on md+ screens */}
          <Image
            src="/logo.svg"
            alt="HifzTutor"
            width={156}
            height={32}
            priority
            unoptimized
            className="hidden md:block select-none"
          />
          {/* Compact mark on small screens */}
          <Image
            src="/logo-mark.svg"
            alt=""
            aria-hidden
            width={28}
            height={28}
            unoptimized
            className="md:hidden select-none"
          />
        </Link>

        {/* Right-side nav */}
        <div className="flex items-center gap-3">
          {/* Subtle secondary button: Find a HifzTutor */}
          <Link
            href="/tutors"
            className="rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ color: '#111629', borderColor: '#111629' }}
          >
            Find a HifzTutor
          </Link>

          {/* Become a HifzTutor (links to /become-a-tutor) */}
          <Link
            href="/become-a-tutor"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50"
          >
            Become a HifzTutor
          </Link>

          {/* Sign in */}
          <Link
            href="/student/signin"
            className="rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ borderColor:BRAND.deep }}
          >
            Log in
          </Link>

          {/* Primary CTA: Get started */}
          <Link
            href="/student/signup"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-900 hover:opacity-95"
            style={{ backgroundColor: BRAND.yellow , borderColor:BRAND.deep }}
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
