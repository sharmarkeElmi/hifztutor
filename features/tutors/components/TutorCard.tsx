"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatGBP, initials, formatLanguages, formatSubjects } from "@features/tutors/lib/format";

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
    subjects?: string[] | null;
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
  const subjects = (tutor.subjects ?? []).filter((subject) => !!subject?.trim());
  const subjectsFallback = formatSubjects(tutor.subjects);
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
      className="group relative h-full cursor-pointer rounded-2xl border border-[#E3E8EF] bg-white p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501] md:p-6 md:hover:-translate-y-1 md:hover:shadow-lg"
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

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-8">
        <div className="md:hidden pr-14">
          <div className="flex items-center gap-2">
            <Link
              href={href}
              className="inline-flex items-center gap-2 text-lg font-bold leading-tight text-[#101828] hover:underline focus:outline-none focus-visible:underline"
              title={name}
              onClick={(event) => event.stopPropagation()}
            >
              <span>{name}</span>
              {countryFlag ? <span className="text-lg" aria-hidden>{countryFlag}</span> : null}
            </Link>
          </div>
          {yearsLabel ? (
            <span className="mt-1 inline-flex items-center rounded-full bg-[#F4F6FB] px-2.5 py-0.5 text-[11px] font-semibold text-[#344054]">
              {yearsLabel}
            </span>
          ) : null}
        </div>

        <Link
          href={href}
          className="relative block overflow-hidden rounded-xl border border-[#E3E8EF] bg-[#F9FAFB] focus:outline-none focus:ring-4 focus:ring-[#D3F501]/70 md:h-[170px] md:w-[180px]"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="sr-only">View {name}&apos;s profile</span>
          <div className="h-40 w-full md:h-full">
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
          <div className="hidden flex-wrap items-center gap-2 md:flex">
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

          <div className="flex items-center gap-2 text-sm font-semibold text-[#101828] md:hidden">
            <span>{rate}</span>
            <span className="text-xs font-normal text-[#667085]">per 60 min</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475467]">
            {subjects.length > 0 ? (
              subjects.map((subject, index) => (
                <span
                  key={`${subject}-${index}`}
                  className="inline-flex items-center gap-1 rounded-md bg-[#F4F6FB] px-2 py-0.5"
                >
                  <span className="inline-block h-1 w-1 rounded-full bg-[#7C8FFF]/80" />
                  <span className="tracking-tight">{subject}</span>
                </span>
              ))
            ) : (
              <span className="rounded-md bg-[#F4F5F7] px-2 py-0.5 text-[#98A2B3]">{subjectsFallback}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#475467]">
            {languages.length > 0 ? (
              languages.map((lang, index) => (
                <span
                  key={`${lang}-${index}`}
                  className="inline-flex items-center gap-1 rounded-md bg-[#F7F9FF] px-2 py-0.5"
                >
                  <span className="inline-block h-1 w-1 rounded-full bg-[#D3F501]/80" />
                  <span className="tracking-tight">{lang}</span>
                </span>
              ))
            ) : (
              <span className="rounded-md bg-[#F4F5F7] px-2 py-0.5 text-[#98A2B3]">{languagesFallback}</span>
            )}
          </div>

          <p className="text-[15px] font-semibold text-[#1F2937]">
            {headline ?? "This tutor is still writing their headline."}
          </p>
          <Link
            href={href}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#111629] underline"
            onClick={(event) => event.stopPropagation()}
          >
            Learn more
          </Link>
        </div>

        <div className="mt-2 flex w-full flex-col gap-2 md:mt-0 md:w-60 md:justify-between md:gap-4 md:rounded-xl md:border md:border-[#E3E8EF] md:bg-[#F9FAFB] md:p-4 md:text-center">
          <div className="hidden md:block space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#475467]">Hourly rate</div>
            <div className="text-[28px] font-extrabold text-[#101828]">{rate}</div>
            <div className="text-xs text-[#667085]">per 60 min lesson</div>
          </div>
          <div className="flex w-full gap-2 md:flex-col md:gap-3">
            <Link
              href={href}
              className="flex h-11 flex-1 items-center justify-center rounded-lg border-2 border-[#111629] bg-[#D3F501] px-4 text-sm font-semibold text-[#111629] transition hover:bg-[#BEE200] md:w-full"
              onClick={(event) => event.stopPropagation()}
            >
              Book trial lesson
            </Link>
            <Link
              href={onMessageHref}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-2 text-sm font-semibold text-[#111629] transition hover:bg-[#F4F6FB] md:w-full"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="md:hidden" aria-hidden>
                <Image src="/Messages-icon.svg" alt="" width={18} height={18} />
              </span>
              <span className="hidden md:inline">Message</span>
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
