// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HifzTutor",
  description: "Find trusted Hifz tutors and book live lessons",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-semibold">HifzTutor</Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="hover:underline">Dashboard</Link>
              <Link
                href="/signin"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Sign in
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}