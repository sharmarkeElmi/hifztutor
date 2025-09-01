"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 bg-[#111629] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:flex md:justify-between md:items-start">
          {/* Brand / blurb */}
          <div>
            <div className="text-2xl font-extrabold text-[#F7D250]">HifzTutor</div>
            <p className="mt-2 max-w-md text-sm text-[#CDD5E0]">
              Find trusted Qur’an / Hifz tutors and book trial lessons with ease.
            </p>
          </div>

          {/* Col 1 */}
          <nav className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-[#F7D250]">Product</div>
            <ul className="space-y-1 text-sm">
              <li><Link href="/tutors" className="text-[#CDD5E0] hover:text-[#D3F501]">Find a tutor</Link></li>
              <li><Link href="/become-a-tutor" className="text-[#CDD5E0] hover:text-[#D3F501]">Become a tutor</Link></li>
              <li><Link href="/pricing" className="text-[#CDD5E0] hover:text-[#D3F501]">Pricing</Link></li>
            </ul>
          </nav>

          {/* Col 2 */}
          <nav className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-[#F7D250]">Company</div>
            <ul className="space-y-1 text-sm">
              <li><Link href="/about" className="text-[#CDD5E0] hover:text-[#D3F501]">About</Link></li>
              <li><Link href="/contact" className="text-[#CDD5E0] hover:text-[#D3F501]">Contact</Link></li>
              <li><Link href="/blog" className="text-[#CDD5E0] hover:text-[#D3F501]">Blog</Link></li>
            </ul>
          </nav>

          {/* Col 3 */}
          <nav className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-[#F7D250]">Legal</div>
            <ul className="space-y-1 text-sm">
              <li><Link href="/terms" className="text-[#CDD5E0] hover:text-[#D3F501]">Terms</Link></li>
              <li><Link href="/privacy" className="text-[#CDD5E0] hover:text-[#D3F501]">Privacy</Link></li>
              <li><Link href="/cookies" className="text-[#CDD5E0] hover:text-[#D3F501]">Cookies</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 border-t border-[#CDD5E0] pt-6 text-xs text-[#CDD5E0] md:flex-row">
          <div>© {new Date().getFullYear()} HifzTutor. All rights reserved.</div>
          <div className="flex items-center gap-3">
            <Link href="https://x.com" className="text-[#CDD5E0] hover:text-[#D3F501]">X</Link>
            <Link href="https://instagram.com" className="text-[#CDD5E0] hover:text-[#D3F501]">Instagram</Link>
            <Link href="https://facebook.com" className="text-[#CDD5E0] hover:text-[#D3F501]">Facebook</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}