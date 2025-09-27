"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatGBP, initials, formatLanguages } from "@features/tutors/lib/format";

export type TutorCardProps = {
  tutor: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    rate_cents?: number | null;
    languages?: string[] | null;
    headline?: string | null;
    years_experience?: number | null;
    country_code?: string | null;
  };
  href: string; // profile link
  onMessageHref: string; // /messages/:id
  saveAction?: {
    isSaved: boolean;
    onToggle: () => void;
    isBusy?: boolean;
  };
};

export default function TutorCard({ tutor, href, onMessageHref, saveAction }: TutorCardProps) {
  const router = useRouter();
  const name = tutor.full_name || "Hifz Tutor";
  const headline = tutor.headline?.trim() || null;
  const languages = (tutor.languages ?? []).filter((lang) => !!lang?.trim());
  const languagesFallback = formatLanguages(tutor.languages);
  const yearsLabel =
    typeof tutor.years_experience === "number" ? `${tutor.years_experience}+ yrs exp` : null;
  const rate = formatGBP(tutor.rate_cents ?? null);
  const countryFlag = tutor.country_code ? isoToFlag(tutor.country_code) : null;

  const handleSaveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!saveAction || saveAction.isBusy) return;
    saveAction.onToggle();
  };

  const handleCardClick = () => {
    router.push(href);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  };

  return (
    <div
      className="group relative h-full cursor-pointer rounded-2xl border border-[#E3E8EF] bg-white p-5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] md:p-6 md:hover:-translate-y-1 md:hover:shadow-lg"
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      {saveAction ? (
        <button
          type="button"
          onClick={handleSaveClick}
          aria-label={saveAction.isSaved ? "Remove from saved tutors" : "Save tutor"}
          aria-pressed={saveAction.isSaved}
          className={cn(
            "absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white/95 text-[#111629] shadow-sm backdrop-blur transition hover:bg-[#F4F6FB]",
            saveAction.isSaved && "border-[#111629] bg-[#111629] text-white hover:bg-[#0f1527]",
            saveAction.isBusy && "cursor-not-allowed opacity-60"
          )}
          disabled={saveAction.isBusy}
        >
          <Image
            src="/save-icon.svg"
            alt=""
            width={20}
            height={20}
            className={cn("h-5 w-5", saveAction.isSaved ? "invert" : "")}
          />
        </button>
      ) : null}

      <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
        <Link
          href={href}
          className="relative block overflow-hidden rounded-xl border border-[#E3E8EF] bg-[#F9FAFB] focus:outline-none focus:ring-4 focus:ring-[#D3F501]/70 md:h-[170px] md:w-[180px]"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="sr-only">View {name}&apos;s profile</span>
          <div className="h-44 w-full md:h-full">
            {tutor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tutor.avatar_url} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#E8ECF5] text-3xl font-bold text-[#111629]">
                {initials(name)}
              </div>
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={href}
              className="text-[22px] font-bold leading-tight text-[#101828] hover:underline focus:outline-none focus-visible:underline"
              title={name}
              onClick={(event) => event.stopPropagation()}
            >
              {name}
            </Link>
            {countryFlag ? <span className="text-lg" aria-hidden>{countryFlag}</span> : null}
            {yearsLabel ? (
              <span className="inline-flex items-center rounded-full bg-[#F4F6FB] px-2 py-0.5 text-xs font-semibold text-[#344054]">
                {yearsLabel}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#475467]">
            {languages.length > 0 ? (
              languages.map((lang, index) => (
                <span key={`${lang}-${index}`} className="inline-flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#D3F501]" />
                  {lang}
                </span>
              ))
            ) : (
              <span>{languagesFallback}</span>
            )}
          </div>

          <p className="text-[15px] font-semibold text-[#1F2937]">
            {headline ?? "This tutor is still writing their headline."}
          </p>
          <p className="text-sm text-[#475467]">
            Get a feel for this tutor&apos;s teaching style and what students can expect from lessons.
            <Link
              href={href}
              className="ml-2 font-semibold text-[#111629] underline"
              onClick={(event) => event.stopPropagation()}
            >
              Learn more
            </Link>
          </p>
        </div>

        <div className="flex w-full flex-col justify-between gap-4 rounded-xl border border-[#E3E8EF] bg-[#F9FAFB] p-4 text-center md:w-60">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#475467]">Hourly rate</div>
            <div className="text-[28px] font-extrabold text-[#101828]">{rate}</div>
            <div className="text-xs text-[#667085]">per 60 min lesson</div>
          </div>
          <div className="grid gap-2">
            <Link
              href={href}
              className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-[#111629] bg-[#D3F501] px-4 text-sm font-semibold text-[#111629] transition hover:bg-[#BEE200]"
              onClick={(event) => event.stopPropagation()}
            >
              Book trial lesson
            </Link>
            <Link
              href={onMessageHref}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#111629] transition hover:bg-[#F4F6FB]"
              onClick={(event) => event.stopPropagation()}
            >
              Message
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function isoToFlag(code?: string | null): string | null {
  if (!code || code.length !== 2) return null;
  const base = 127397;
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map((ch) => base + ch.charCodeAt(0)));
  } catch {
    return null;
  }
}
