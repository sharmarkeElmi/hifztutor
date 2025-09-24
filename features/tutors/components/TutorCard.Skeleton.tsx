"use client";

export default function TutorCardSkeleton() {
  return (
    <div className="h-full rounded-2xl border border-[#CDD5E0] bg-white p-5">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 animate-pulse rounded-md bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="text-right">
          <div className="h-3 w-10 animate-pulse rounded bg-gray-100" />
          <div className="mt-1 h-5 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-9 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

