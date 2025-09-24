"use client";

import Link from "next/link";
import { formatGBP, initials, formatLanguages } from "@features/tutors/lib/format";

export type TutorCardProps = {
  tutor: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    rate_cents?: number | null;
    languages?: string[] | null;
  };
  href: string; // profile link
  onMessageHref: string; // /messages/:id
};

export default function TutorCard({ tutor, href, onMessageHref }: TutorCardProps) {
  const name = tutor.full_name || "Hifz Tutor";
  const langs = formatLanguages(tutor.languages);
  const rate = formatGBP(tutor.rate_cents ?? null);

  return (
    <div className="group h-full rounded-2xl border border-[#CDD5E0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 flex-none overflow-hidden rounded-md border border-[#CDD5E0] bg-[#F7F8FA] text-[#111629]">
          {tutor.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={tutor.avatar_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold">
              {initials(name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={href}
            className="truncate text-[18px] font-extrabold leading-snug text-[#111629] hover:underline"
            title={name}
          >
            {name}
          </Link>
          <div className="mt-0.5 truncate text-[13px] text-[#111629] opacity-80">
            {langs}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-medium text-[#111629] opacity-70">Hourly</div>
          <div className="text-xl font-extrabold tracking-tight text-[#111629]">{rate}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={onMessageHref}
          className="inline-flex items-center justify-center rounded-md border border-[#CDD5E0] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#F7D250] hover:text-[#111629]"
        >
          Message
        </Link>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-md bg-[#F7D250] px-3 py-2 text-sm font-semibold text-[#111629] hover:bg-[#D3F501]"
        >
          View profile
        </Link>
      </div>
    </div>
  );
}
