// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import HeaderSwitcher from "./components/HeaderSwitcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HifzTutor",
  description: "Find trusted Hifz tutors and book live lessons",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <HeaderSwitcher>{children}</HeaderSwitcher>
      </body>
    </html>
  );
}