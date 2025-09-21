"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { cx } from "class-variance-authority";
import { useCallback, useEffect, useMemo, useState } from "react";
import { READ_STATE_EVENT } from "@/lib/messages";
import { createBrowserClient } from "@supabase/ssr";

type FilterKey = "all" | "unread" | "archived";

type MessagesShellProps = {
  activeKey: FilterKey;
  children: React.ReactNode;
  hideMobileTabs?: boolean;
  hideDesktopTabs?: boolean;
  initialUnreadCounts?: { totalUnread: number; perConversation: Record<string, number> };
};

export default function MessagesShell({ activeKey, children, hideMobileTabs, hideDesktopTabs, initialUnreadCounts }: MessagesShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseParams = new URLSearchParams(searchParams?.toString() || "");

  const [counts, setCounts] = useState<{ totalUnread: number; perConversation: Record<string, number> }>(() => ({
    totalUnread: initialUnreadCounts?.totalUnread ?? 0,
    perConversation: initialUnreadCounts?.perConversation ?? {},
  }));

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const unreadConversations = useMemo(
    () => Object.values(counts.perConversation || {}).filter((n) => (n ?? 0) > 0).length,
    [counts.perConversation]
  );

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { totalUnread: number; perConversation: Record<string, number> };
      setCounts({ totalUnread: data?.totalUnread ?? 0, perConversation: data?.perConversation ?? {} });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setCounts({
      totalUnread: initialUnreadCounts?.totalUnread ?? 0,
      perConversation: initialUnreadCounts?.perConversation ?? {},
    });
  }, [initialUnreadCounts?.totalUnread, initialUnreadCounts?.perConversation]);

  useEffect(() => {
    const handler = () => refreshCounts();
    if (typeof window !== "undefined") {
      window.addEventListener(READ_STATE_EVENT, handler);
    }
    const id = setInterval(refreshCounts, 20000);
    // Realtime refresh for new incoming messages
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (!uid) return;
        const { data: convs } = await supabase
          .from("conversations")
          .select("id,user_a,user_b")
          .or(`user_a.eq.${uid},user_b.eq.${uid}`);
        const convIds = new Set((convs ?? []).map((c: { id: string }) => c.id));
        if (convIds.size === 0) return;

        const channel = supabase
          .channel("shell-unread")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            (payload) => {
              const row = payload.new as { conversation_id?: string; sender_id?: string };
              if (!row?.conversation_id || !row?.sender_id) return;
              if (!convIds.has(row.conversation_id)) return;
              if (row.sender_id === uid) return;
              refreshCounts();
            }
          )
          .subscribe();
        return () => {
          try { supabase.removeChannel(channel); } catch { /* noop */ }
        };
      } catch { /* ignore */ }
    })();
    return () => {
      if (typeof window !== "undefined") window.removeEventListener(READ_STATE_EVENT, handler);
      clearInterval(id);
    };
  }, [refreshCounts, supabase]);

  const tabs: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "archived", label: "Archived" },
  ];

  const hrefFor = (key: FilterKey) => {
    const p = new URLSearchParams(baseParams.toString());
    p.set("filter", key);
    return `${pathname}?${p.toString()}`.replace(/\?$/, "");
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Mobile sub-nav */}
      {!hideMobileTabs && (
        <div className="sm:hidden bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scrollbar-hide border-b border-slate-200">
          <div
            className="overflow-x-auto scrollbar-hide h-12 bg-white"
            role="tablist"
            aria-label="Messages tabs"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex h-full items-center gap-2">
              {tabs.map((t) => (
                t.key === "archived" ? (
                  <button
                    key={t.key}
                    type="button"
                    title="Coming soon"
                    aria-disabled="true"
                    className={cx(
                      "relative px-4 py-3 text-[15px] font-medium text-slate-400 cursor-not-allowed",
                      activeKey === t.key ? "text-slate-500" : ""
                    )}
                    role="tab"
                    aria-selected={activeKey === t.key}
                  >
                    <span className="leading-none">{t.label}</span>
                    {activeKey === t.key ? (
                      <span
                        className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                        style={{ backgroundColor: "#D3F501" }}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                ) : (
                <Link
                  key={t.key}
                  href={hrefFor(t.key)}
                  className={cx(
                    "relative px-4 py-3 text-[15px] font-medium text-slate-700 hover:text-[#111629] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                    activeKey === t.key ? "text-[#111629] font-semibold" : ""
                  )}
                  role="tab"
                  aria-selected={activeKey === t.key}
                  aria-current={activeKey === t.key ? "page" : undefined}
                >
                  <span className="leading-none">{t.label}</span>
                  {t.key === "unread" && unreadConversations > 0 ? (
                    <span
                      aria-label={`${unreadConversations} with unread`}
                      className="ml-2 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold text-black ring-2 ring-white"
                      style={{ backgroundColor: "#D3F501" }}
                    >
                      {unreadConversations > 99 ? "99+" : unreadConversations}
                    </span>
                  ) : null}
                  {activeKey === t.key ? (
                    <span
                      className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                      style={{ backgroundColor: "#D3F501" }}
                      aria-hidden
                    />
                  ) : null}
                </Link>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop sub-nav */}
      {!hideDesktopTabs && (
        <div className="hidden sm:block border-b border-slate-200 bg-white">
          <ul className="flex items-center gap-2 h-12" role="tablist" aria-label="Messages tabs">
            {tabs.map((t) => (
              <li key={t.key}>
                {t.key === "archived" ? (
                  <button
                    type="button"
                    title="Coming soon"
                    aria-disabled="true"
                    className={cx(
                      "relative px-4 py-3 text-[15px] font-medium text-slate-400 cursor-not-allowed",
                      activeKey === t.key ? "text-slate-500" : ""
                    )}
                    role="tab"
                    aria-selected={activeKey === t.key}
                  >
                    <span className="leading-none">{t.label}</span>
                    {activeKey === t.key ? (
                      <span
                        className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                        style={{ backgroundColor: "#D3F501" }}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                ) : (
                <Link
                  href={hrefFor(t.key)}
                  className={cx(
                    "relative px-4 py-3 text-[15px] font-medium text-slate-700 hover:text-[#111629] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3F501]",
                    activeKey === t.key ? "text-[#111629] font-semibold" : ""
                  )}
                  role="tab"
                  aria-selected={activeKey === t.key}
                  aria-current={activeKey === t.key ? "page" : undefined}
                >
                  <span className="leading-none">{t.label}</span>
                  {t.key === "unread" && unreadConversations > 0 ? (
                    <span
                      aria-label={`${unreadConversations} with unread`}
                      className="ml-2 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold text-black ring-2 ring-white"
                      style={{ backgroundColor: "#D3F501" }}
                    >
                      {unreadConversations > 99 ? "99+" : unreadConversations}
                    </span>
                  ) : null}
                  {activeKey === t.key ? (
                    <span
                      className="pointer-events-none absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                      style={{ backgroundColor: "#D3F501" }}
                      aria-hidden
                    />
                  ) : null}
                </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content (aligned to sub‑nav; no top gap) */}
      <div className="pt-0 pb-0 overflow-hidden">{children}</div>
    </section>
  );
}
