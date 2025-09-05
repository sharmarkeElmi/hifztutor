"use client";

/**
 * Student Lessons
 * ----------------
 * Lists the authenticated student's bookings, grouped by Upcoming / Past.
 * - Reads from `bookings` (RLS should allow a student to select their own rows).
 * - Pulls tutor profile names/avatars with a second batched query (no N+1).
 * - Uses your dashboard Shell so it fits the app chrome.
 */

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Lightweight types that match your DB columns used below
type BookingRow = {
  id: string;
  tutor_id: string;
  student_id: string;
  slot_id: string | null;
  starts_at: string;   // timestamptz in ISO
  ends_at: string;     // timestamptz in ISO
  price_cents: number | null;
  status: string;      // e.g. "booked", "completed", "canceled"
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

function fmt(dtISO: string) {
  const d = new Date(dtISO);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function StudentLessonsPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [tutorsById, setTutorsById] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch student's bookings + counterpart (tutor) profiles
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);

      // 1) Who am I?
      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user;
      if (!me) {
        if (isMounted) {
          setLoading(false);
          setError("You must be signed in to view lessons.");
        }
        return;
      }

      // 2) Get my bookings
      const { data: rows, error: selErr } = await supabase
        .from("bookings")
        .select(
          "id,tutor_id,student_id,slot_id,starts_at,ends_at,price_cents,status,created_at"
        )
        .eq("student_id", me.id)
        .order("starts_at", { ascending: true });

      if (selErr) {
        if (isMounted) {
          setLoading(false);
          setError(selErr.message);
        }
        return;
      }

      // 3) Batch-fetch tutor profiles
      const tutorIds = Array.from(new Set((rows ?? []).map(r => r.tutor_id))).filter(Boolean);
      let tutorMap: Record<string, Profile> = {};
      if (tutorIds.length) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", tutorIds);

        if (!profErr && profs) {
          tutorMap = Object.fromEntries(profs.map(p => [p.id, p as Profile]));
        }
      }

      if (isMounted) {
        setBookings(rows ?? []);
        setTutorsById(tutorMap);
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const up: BookingRow[] = [];
    const pa: BookingRow[] = [];
    for (const b of bookings) {
      const starts = new Date(b.starts_at).getTime();
      if (starts >= now && b.status !== "canceled") up.push(b);
      else pa.push(b);
    }
    return { upcoming: up, past: pa };
  }, [bookings, now]);

  return (
    <>
      <div className="p-4 md:p-6">
        <div className="relative overflow-hidden rounded-xl border bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Lessons</h1>
          <p className="text-slate-600 mt-1">Your scheduled and previous sessions.</p>
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10" style={{ background: '#D3F501' }} />
        </div>

        {loading && (
          <div className="mt-4 rounded-lg border bg-white p-4 text-sm text-slate-600">Loading…</div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <div className="mt-6 space-y-8 sm:space-y-10">
            {/* Upcoming */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="rounded-xl border p-5 text-sm text-slate-600 bg-white shadow-sm">
                  No upcoming lessons yet.
                </div>
              ) : (
                <ul className="grid gap-3 sm:gap-4">
                  {upcoming.map(b => {
                    const t = tutorsById[b.tutor_id];
                    return (
                      <li key={b.id} className="rounded-xl border p-4 sm:p-5 flex items-center justify-between bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="h-10 w-10 rounded-full overflow-hidden border" style={{ borderColor: '#CDD5E0', background: '#F7F8FA' }}>
                            {t?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-medium">
                              {t?.full_name ?? "Tutor"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {fmt(b.starts_at)} — {fmt(b.ends_at)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          {typeof b.price_cents === 'number' && (
                            <div className="text-sm text-slate-600">
                              {(b.price_cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                            </div>
                          )}
                          <span className="inline-block text-xs rounded px-2 py-1 border" style={{ background: '#F7D250', color: '#111629', borderColor: '#F7D250' }}>
                            {b.status}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Past */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Past</h2>
              {past.length === 0 ? (
                <div className="rounded-xl border p-5 text-sm text-slate-600 bg-white shadow-sm">
                  No past lessons yet.
                </div>
              ) : (
                <ul className="grid gap-3 sm:gap-4">
                  {past.map(b => {
                    const t = tutorsById[b.tutor_id];
                    return (
                      <li key={b.id} className="rounded-xl border p-4 sm:p-5 flex items-center justify-between bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden border" style={{ borderColor: '#CDD5E0', background: '#F7F8FA' }}>
                            {t?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-medium">
                              {t?.full_name ?? "Tutor"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {fmt(b.starts_at)} — {fmt(b.ends_at)}
                            </div>
                          </div>
                        </div>
                        <span className="inline-block text-xs rounded px-2 py-1 border" style={{ background: '#F7F8FA', color: '#111629', borderColor: '#CDD5E0' }}>
                          {b.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}