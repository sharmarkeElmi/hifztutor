"use client";

import React from "react";

export default function InboxSplit({
  list,
  pane,
}: {
  list: React.ReactNode;   // left column (conversations)
  pane: React.ReactNode;   // right column (thread or empty state)
}) {
  return (
    <div className="w-full">
      {/* Desktop split; mobile stacks */}
      <div className="grid gap-4 md:grid-cols-[360px,1fr]">
        {/* Left list */}
        <aside className="rounded-lg border border-slate-200 bg-white">
          {list}
        </aside>

        {/* Right pane */}
        <section className="rounded-lg border border-slate-200 bg-white min-h-[60vh]">
          {pane}
        </section>
      </div>
    </div>
  );
}
