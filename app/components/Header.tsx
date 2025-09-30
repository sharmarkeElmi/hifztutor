// app/components/Header.tsx
"use client";

/**
 * Public Header (signed-out navigation)
 * Shown on marketing/auth pages only.
 * Hidden on /student, /tutor, /lesson, /inbox via HeaderSwitcher.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@components/ui/button";
import { cn } from "@/lib/utils";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/landing" },
    { label: "Find a HifzTutor", href: "/tutors" },
    { label: "Become a HifzTutor", href: "/become-a-tutor" },
  ];

  const isActive = (href: string) => {
    if (href === "/landing") {
      return pathname === "/" || pathname === "/landing";
    }
    return pathname.startsWith(href);
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white">
      <nav className="flex w-full items-center justify-between px-4 py-3 md:px-8">
        {/* Logo */}
        <Link href="/landing" aria-label="HifzTutor home" className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="HifzTutor"
            width={148}
            height={30}
            priority
            unoptimized
            className="select-none"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/tutors"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-11 rounded-lg px-5 text-[#111629] transition-colors hover:bg-[#F4F6FB]"
            )}
          >
            Find a HifzTutor
          </Link>
          <Link
            href="/become-a-tutor"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Become a HifzTutor
          </Link>
          <Link
            href="/signin"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "h-11 rounded-lg px-5 text-sm font-semibold tracking-wide transition-colors hover:brightness-95"
            )}
          >
            <Image src="/Login-Icon.svg" alt="" aria-hidden width={18} height={18} className="h-[18px] w-[18px]" />
            <span className="leading-none">Log in</span>
          </Link>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <Image src="/mobile-dropdown-icon.svg" alt="" aria-hidden width={20} height={22} className="h-5 w-6" />
        </button>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen ? (
        <div className="md:hidden">
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/40"
              aria-hidden
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] translate-x-0 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
                <Link
                  href="/signin"
                  className="flex items-center gap-3 text-base font-semibold text-[#111629]"
                  onClick={() => setMobileOpen(false)}
                >
                  <Image src="/desktop-dropdown-icon.svg" alt="" width={24} height={24} className="select-none" />
                  <span className="tracking-tight">Log in</span>
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="rounded-md p-1 text-2xl text-slate-500 hover:text-slate-700"
                  onClick={() => setMobileOpen(false)}
                >
                  ×
                </button>
              </div>

              <nav className="flex flex-col gap-1 px-2 py-4 text-[#111629]">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-3 text-base font-semibold transition-colors",
                        active ? "bg-[#F4F6FB]" : "hover:bg-slate-50"
                      )}
                    >
                      <span>{item.label}</span>
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-[#D3F501]"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
