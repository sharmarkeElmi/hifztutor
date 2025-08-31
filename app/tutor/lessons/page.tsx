"use client";

/**
 * Tutor Lessons
 * -------------
 * Lists the authenticated tutor's bookings with student info,
 * grouped by Upcoming / Past.
 */

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Shell from "@/app/components/dashboard/Shell";

type BookingRow = {
  id: string;
  tutor_id: string;
  student_id: string;
  slot_id: string | null;
  starts_at: string;
  ends_at: string;
  price_cents: number | null;
  status: string;
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

export default function TutorLessonsPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);

      const { data: auth } = await supabase.auth.getUser();
      const me = auth?.user;
      if (!me) {
        if (isMounted) {
          setLoading(false);
          setError("You must be signed in to view lessons.");
        }
        return;
      }

      const { data: rows, error: selErr } = await supabase
        .from("bookings")
        .select(
          "id,tutor_id,student_id,slot_id,starts_at,ends_at,price_cents,status,created_at"
        )
        .eq("tutor_id", me.id)
        .order("starts_at", { ascending: true });

      if (selErr) {
        if (isMounted) {
          setLoading(false);
          setError(selErr.message);
        }
        return;
      }

      const studentIds = Array.from(new Set((rows ?? []).map(r => r.student_id))).filter(Boolean);
      let studentMap: Record<string, Profile> = {};
      if (studentIds.length) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", studentIds);

        if (!profErr && profs) {
          studentMap = Object.fromEntries(profs.map(p => [p.id, p as Profile]));
        }
      }

      if (isMounted) {
        setBookings(rows ?? []);
        setStudentsById(studentMap);
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
    <Shell role="tutor" activeKey="lessons">
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-semibold">Lessons</h1>
        <p className="text-muted-foreground">Your scheduled sessions with students.</p>

        {loading && <p className="mt-4">Loading…</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="mt-6 space-y-10">
            {/* Upcoming */}
            <section>
              <h2 className="text-lg font-medium mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No upcoming lessons yet.
                </div>
              ) : (
                <ul className="grid gap-3">
                  {upcoming.map(b => {
                    const s = studentsById[b.student_id];
                    return (
                      <li key={b.id} className="rounded-md border p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden">
                            {s?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-medium">
                              {s?.full_name ?? "Student"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {fmt(b.starts_at)} — {fmt(b.ends_at)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {typeof b.price_cents === "number" && (
                            <div className="text-sm">
                              {(b.price_cents / 100).toLocaleString(undefined, {
                                style: "currency",
                                currency: "USD",
                              })}
                            </div>
                          )}
                          <span className="inline-block text-xs rounded px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
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
              <h2 className="text-lg font-medium mb-3">Past</h2>
              {past.length === 0 ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No past lessons yet.
                </div>
              ) : (
                <ul className="grid gap-3">
                  {past.map(b => {
                    const s = studentsById[b.student_id];
                    return (
                      <li key={b.id} className="rounded-md border p-4 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden">
                            {s?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-medium">{s?.full_name ?? "Student"}</div>
                            <div className="text-sm text-muted-foreground">
                              {fmt(b.starts_at)} — {fmt(b.ends_at)}
                            </div>
                          </div>
                        </div>
                        <span className="inline-block text-xs rounded px-2 py-1 bg-slate-100 text-slate-600 border">
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
    </Shell>
  );
}