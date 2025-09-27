"use client";

export default function TutorCardSkeleton() {
  return (
    <div className="relative h-full rounded-2xl border border-[#E3E8EF] bg-white p-5 shadow-sm md:p-6">
      <div className="absolute right-5 top-5 h-10 w-10 rounded-full bg-gray-100" />
      <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
        <div className="h-44 w-full animate-pulse rounded-xl bg-gray-200 md:h-[170px] md:w-[180px] md:flex-none" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-5 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-12 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex w-full flex-col justify-between gap-4 rounded-xl border border-[#E3E8EF] bg-[#F9FAFB] p-4 md:w-60">
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-7 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="grid gap-2">
            <div className="h-11 w-full animate-pulse rounded-lg bg-gray-200" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
