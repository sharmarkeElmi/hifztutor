"use client";

/**
 * Tutor Availability
 * -------------------
 * Minimal CRUD UI for lesson_slots:
 * - List future slots you own
 * - Create new future "available" slots
 * - Delete your own "available" future slots
 *
 * Relies on RLS policies you already created.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Helpers for UI formatting
const gbFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
});

function toLocalInputValue(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function isSameDate(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
function addMonths(d: Date, n: number) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function monthLabel(d: Date) {
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
// Returns a 6x7 (42) grid of dates covering the calendar month view
function monthGrid(month: Date): Date[] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    // start from Sunday (0) column
    start.setDate(first.getDate() - first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
    }
    return days;
}

function defaultStartLocal(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 120);
    now.setSeconds(0, 0);
    const minutes = now.getMinutes();
    if (minutes % 30 !== 0) {
        now.setMinutes(minutes + (30 - (minutes % 30)));
    }
    return toLocalInputValue(now);
}

type Slot = {
    id: string;
    tutor_id: string;
    starts_at: string; // ISO
    ends_at: string;   // ISO
    price_cents: number;
    status: "available" | "held" | "booked" | "canceled";
    room_name: string | null;
    created_at: string;
};

export default function TutorAvailabilityPage() {
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState<string | null>(null);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [form, setForm] = useState({
        // default start: +2 hours rounded to next half hour
        startsAtLocal: "",
        durationMins: 30,
        priceCents: 0,
    });
    const [creating, setCreating] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Create the Supabase client once per component instance (avoids module-scope state issues during HMR)
    const supabase = useMemo(
        () =>
            createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            ),
        []
    );

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // quick helpers
    const bumpStart = (mins: number) => {
        setForm((f) => {
            const d = fromLocalInputValue(f.startsAtLocal) ?? new Date();
            d.setMinutes(d.getMinutes() + mins);
            return { ...f, startsAtLocal: toLocalInputValue(d) };
        });
    };
    const setDurationQuick = (mins: number) =>
        setForm((f) => ({ ...f, durationMins: mins }));
    const setPriceQuick = (cents: number) =>
        setForm((f) => ({ ...f, priceCents: cents }));
    const resetForm = () =>
        setForm({ startsAtLocal: defaultStartLocal(), durationMins: 30, priceCents: 0 });

    // initialize defaults for form (runs once on client)
    useEffect(() => {
        setForm((f) => ({
            ...f,
            startsAtLocal: defaultStartLocal(),
        }));
    }, []);

    // Auth guard + load slots
    const loadSlots = useCallback(async (uid: string) => {
        setErr(null);
        const { data, error } = await supabase
            .from("lesson_slots")
            .select("*")
            .eq("tutor_id", uid)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true });
        if (error) {
            setErr(error.message);
            setSlots([]);
            return;
        }
        setSlots(data as Slot[]);
    }, [supabase]);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error("Failed to verify auth in tutor availability:", userError.message);
            }
            const user = userData?.user;
            if (!user) {
                const next = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : undefined;
                window.location.replace(next ? `/signin?next=${encodeURIComponent(next)}` : "/signin");
                return;
            }
            const uid = user.id;
            setMyId(uid);

            // (Optional) ensure role is tutor, else bounce to student dash
            const { data: prof } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", uid)
                .maybeSingle();
            if (prof?.role !== "tutor") {
                window.location.replace("/student/dashboard");
                return;
            }

            await loadSlots(uid);

            if (active) setLoading(false);
        })();

        return () => { active = false; };
    }, [loadSlots, supabase]);

    function fromLocalInputValue(v: string): Date | null {
        if (!v) return null;
        // treat as local time
        const dt = new Date(v);
        if (isNaN(dt.getTime())) return null;
        return dt;
    }

    // Calendar state (which month is shown)
    const [calMonth, setCalMonth] = useState<Date>(() => {
        const init = fromLocalInputValue(form.startsAtLocal) ?? new Date();
        return new Date(init.getFullYear(), init.getMonth(), 1);
    });

    // Memoize today's start of day for calendar grid
    const today = useMemo(() => startOfDay(new Date()), []);

    // Days that already have slots (for small indicators on the calendar)
    const slotDays = useMemo(
        () => new Set(slots.map((s) => new Date(s.starts_at).toDateString())),
        [slots]
    );

    const handlePickDate = (d: Date) => {
        // preserve the time from current selection; replace date part
        const current = fromLocalInputValue(form.startsAtLocal) ?? new Date();
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), current.getHours(), current.getMinutes(), 0, 0);
        setForm((f) => ({ ...f, startsAtLocal: toLocalInputValue(local) }));
    };

    // Memoized helper for time input value
    const timeInputValue = useMemo(() => {
        const dt = fromLocalInputValue(form.startsAtLocal) ?? new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }, [form.startsAtLocal]);

    const endLocalDisplay = useMemo(() => {
        const start = fromLocalInputValue(form.startsAtLocal);
        if (!start) return "";
        const end = new Date(start.getTime() + form.durationMins * 60000);
        return end.toLocaleString();
    }, [form.startsAtLocal, form.durationMins]);

    const startLocalDate = useMemo(
        () => fromLocalInputValue(form.startsAtLocal),
        [form.startsAtLocal]
    );

    const canSubmit = useMemo(() => {
        if (!startLocalDate) return false;
        const now = new Date();
        const end = new Date(startLocalDate.getTime() + form.durationMins * 60000);
        const durationOk = form.durationMins >= 15 && form.durationMins <= 240;
        const priceOk = form.priceCents >= 0;
        return end > now && durationOk && priceOk;
    }, [startLocalDate, form.durationMins, form.priceCents]);


    // Jump forward to the next half-hour mark from the currently selected time
    const setNextHalfHour = () => {
      const curr = fromLocalInputValue(form.startsAtLocal) ?? new Date();
      const minutes = curr.getMinutes();
      const add = minutes % 30 === 0 ? 30 : 30 - (minutes % 30);
      bumpStart(add);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!myId) return;
        setCreating(true);
        setErr(null);

        const startLocal = fromLocalInputValue(form.startsAtLocal);
        if (!startLocal) {
            setErr("Please choose a valid start date/time.");
            setCreating(false);
            return;
        }
        const endLocal = new Date(startLocal.getTime() + form.durationMins * 60000);

        // Convert local -> ISO UTC
        const starts_at = new Date(startLocal.getTime() - startLocal.getTimezoneOffset() * 60000).toISOString();
        const ends_at = new Date(endLocal.getTime() - endLocal.getTimezoneOffset() * 60000).toISOString();

        const { error } = await supabase.from("lesson_slots").insert({
            tutor_id: myId,
            starts_at,
            ends_at,
            price_cents: form.priceCents || 0,
            status: "available",
        });

        if (error) {
            setErr(error.message);
            setCreating(false);
            return;
        }

        await loadSlots(myId);
        setCreating(false);
    };

    const handleDelete = async (slotId: string) => {
        if (!confirm("Delete this slot?")) return;
        setErr(null);
        const { error } = await supabase
            .from("lesson_slots")
            .delete()
            .eq("id", slotId);
        if (error) {
            setErr(error.message);
            return;
        }
        if (myId) await loadSlots(myId);
    };

    return (
        <>
            <div className="relative overflow-hidden rounded-xl border bg-white p-6 sm:p-7 shadow-sm mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Availability</h1>
                <p className="text-slate-600 mt-1">Publish bookable time slots for students to reserve.</p>
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10" style={{ background: '#D3F501' }} />
            </div>

            <form
                onSubmit={handleCreate}
                className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
                <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-semibold">Create a new slot</h2>
                        <p className="text-sm text-gray-500">Pick a date &amp; time, then set duration and price.</p>
                    </div>
                    <p className="text-xs text-gray-500">
                        All times in <span className="font-medium">{timeZone}</span>
                    </p>
                </div>

                {/* Responsive 12-col: calendar spans 7, controls 5 on lg; stack on small */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Calendar + time (left) */}
                    <div className="lg:col-span-7">
                        <label className="mb-2 block text-sm font-medium">Date &amp; time</label>

                        {/* Calendar header */}
                        <div className="mb-2 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCalMonth((m) => addMonths(m, -1))}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                                aria-label="Previous month"
                                title="Previous month"
                                style={{ color: '#111629' }}
                            >
                                ‹
                            </button>
                            <div className="text-sm font-semibold">{monthLabel(calMonth)}</div>
                            <button
                                type="button"
                                onClick={() => setCalMonth((m) => addMonths(m, 1))}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                                aria-label="Next month"
                                title="Next month"
                                style={{ color: '#111629' }}
                            >
                                ›
                            </button>
                        </div>

                        {/* Calendar grid */}
                        <div className="overflow-hidden rounded-lg border">
                            <div className="grid grid-cols-7 border-b bg-gray-50 text-center text-xs font-medium text-gray-600">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                                    <div key={d} className="py-2" aria-hidden="true">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 text-center">
                                {monthGrid(calMonth).map((d, i) => {
                                    const isCurrentMonth = d.getMonth() === calMonth.getMonth();
                                    const disabled = startOfDay(d) < today; // past dates disabled
                                    const selected = (() => {
                                        const sel = fromLocalInputValue(form.startsAtLocal);
                                        return sel ? isSameDate(sel, d) : false;
                                    })();
                                    const todayCell = isSameDate(d, new Date());
                                    const hasSlots = slotDays.has(d.toDateString());
                                    return (
                                        <button
                                            type="button"
                                            key={d.toISOString()}
                                            disabled={disabled}
                                            onClick={() => handlePickDate(d)}
                                            title={d.toLocaleDateString()}
                                            className={[
                                                "relative h-12 border-t",
                                                i % 7 !== 6 ? "border-r" : "",
                                                disabled ? "cursor-not-allowed text-gray-300" : "hover:bg-[#F7F8FA]",
                                                isCurrentMonth ? "bg-white" : "bg-gray-50",
                                                selected ? "bg-[#F7D250] text-[#111629] font-medium ring-1 ring-[#F7D250]" : "",
                                                todayCell && !selected ? "ring-1 ring-[#D3F501]" : "",
                                                "focus:outline-none focus:ring-2 focus:ring-[#F7D250]",
                                            ].join(" ")}
                                        >
                                            <span className="text-sm">{d.getDate()}</span>
                                            {hasSlots && (
                                                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time picker (simplified) */}
                        <div className="mt-3">
                          <label htmlFor="start-time" className="mb-1 block text-sm font-medium">Start time</label>
                          <div className="flex flex-wrap items-center gap-2">
                          <input
                              id="start-time"
                              type="time"
                              step={900}
                              value={timeInputValue}
                              onChange={(e) => {
                                const [h, m] = e.target.value.split(":").map((n) => parseInt(n, 10));
                                const curr = fromLocalInputValue(form.startsAtLocal) ?? new Date();
                                const next = new Date(
                                  curr.getFullYear(),
                                  curr.getMonth(),
                                  curr.getDate(),
                                  Number.isFinite(h) ? h : 0,
                                  Number.isFinite(m) ? m : 0,
                                  0,
                                  0
                                );
                                setForm((f) => ({ ...f, startsAtLocal: toLocalInputValue(next) }));
                              }}
                              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                              aria-label="Start time"
                            />

                            {/* Quick adjust */}
                            <div className="ml-1 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => bumpStart(-15)}
                                className="rounded-full border px-2 py-1 text-xs hover:bg-[#F7F8FA]"
                                title="Back 15 minutes"
                              >
                                −15m
                              </button>
                              <button
                                type="button"
                                onClick={() => bumpStart(15)}
                                className="rounded-full border px-2 py-1 text-xs hover:bg-[#F7F8FA]"
                                title="Forward 15 minutes"
                              >
                                +15m
                              </button>
                              <button
                                type="button"
                                onClick={() => bumpStart(60)}
                                className="rounded-full border px-2 py-1 text-xs hover:bg-[#F7F8FA]"
                                title="Forward 1 hour"
                              >
                                +1h
                              </button>
                              <button
                                type="button"
                                onClick={setNextHalfHour}
                                className="rounded-full border px-2 py-1 text-xs hover:bg-[#F7F8FA]"
                                title="Jump to next half‑hour"
                              >
                                Next 30m
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const curr = fromLocalInputValue(form.startsAtLocal) ?? new Date();
                                const next = new Date(curr);
                                next.setDate(curr.getDate() + 1);
                                setForm((f) => ({ ...f, startsAtLocal: toLocalInputValue(next) }));
                                setCalMonth(new Date(next.getFullYear(), next.getMonth(), 1));
                              }}
                              className="rounded-md border px-2 py-1 text-xs hover:bg-[#F7F8FA]"
                              title="Same time tomorrow"
                            >
                              Tomorrow
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                resetForm();
                                setCalMonth(new Date());
                              }}
                              className="ml-auto rounded-md border px-2 py-1 text-xs hover:bg-[#F7F8FA]"
                            >
                              Reset
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Local time:&nbsp;<span className="font-medium">{timeZone}</span>
                          </p>
                        </div>
                    </div>

                    {/* Controls (right) */}
                    <div className="lg:col-span-5">
                        <div className="grid gap-5">
                            {/* Duration */}
                            <div>
                                <label htmlFor="duration-mins" className="mb-1 block text-sm font-medium">Duration (minutes)</label>
                                <input
                                    id="duration-mins"
                                    type="number"
                                    min={15}
                                    step={15}
                                    value={form.durationMins}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, durationMins: Number(e.target.value) || 30 }))
                                    }
                                    aria-label="Duration in minutes"
                                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[30, 45, 60, 90].map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setDurationQuick(m)}
                                            className={[
                                                "rounded-full border px-3 py-1 text-xs",
                                                "hover:bg-gray-50",
                                                form.durationMins === m ? "border-[#F7D250] bg-[#FFF3C2] text-[#111629]" : "",
                                            ].join(" ")}
                                        >
                                            {m}m
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Price */}
                            <div>
                                <label htmlFor="price-cents" className="mb-1 block text-sm font-medium">Price (cents)</label>
                                <input
                                    id="price-cents"
                                    type="number"
                                    min={0}
                                    value={form.priceCents}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, priceCents: Number(e.target.value) || 0 }))
                                    }
                                    aria-label="Price in pence"
                                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F7D250]"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[0, 500, 1000, 1500, 2000, 2500].map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setPriceQuick(c)}
                                            className={[
                                                "rounded-full border px-3 py-1 text-xs",
                                                "hover:bg-gray-50",
                                                form.priceCents === c ? "border-[#F7D250] bg-[#FFF3C2] text-[#111629]" : "",
                                            ].join(" ")}
                                        >
                                            {gbFormatter.format(c / 100)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Live summary */}
                            <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Start</span>
                                    <span className="font-medium">
                                        {fromLocalInputValue(form.startsAtLocal)?.toLocaleString() ?? "—"}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-slate-600">End</span>
                                    <span className="font-medium">{endLocalDisplay || "—"}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-slate-600">Duration</span>
                                    <span className="font-medium">{form.durationMins}m</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-slate-600">Price</span>
                                    <span className="font-medium">
                                        {gbFormatter.format((form.priceCents || 0) / 100)}
                                    </span>
                                </div>
                            </div>

                            {/* Conflict note (simple self-overlap) */}
                            {(() => {
                                const start = fromLocalInputValue(form.startsAtLocal);
                                if (!start) return null;
                                const end = new Date(start.getTime() + form.durationMins * 60000);
                                const overlaps = slots.some((s) => {
                                    const S = new Date(s.starts_at);
                                    const E = new Date(s.ends_at);
                                    return s.status !== "canceled" && S < end && E > start;
                                });
                                return overlaps ? (
                                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        Heads up: this overlaps with one of your existing slots.
                                    </div>
                                ) : null;
                            })()}

                            {/* Submit */}
                            <div>
                                {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
                                <button
                                    type="submit"
                                    disabled={!canSubmit || creating}
                                    className="inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-[#111629] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ backgroundColor: '#F7D250' }}
                                    title={!canSubmit ? "Pick a future start time and a valid duration/price" : "Add slot"}
                                >
                                    {creating ? "Creating…" : "Add slot"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            {/* Slots list */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="font-medium mb-3">Your upcoming slots</h2>

                {slots.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-600 bg-white shadow-sm">
                        No upcoming slots. Use the form above to publish your first availability.
                    </div>
                ) : (
                    <ul className="divide-y">
                        {slots.map((s) => (
                            <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <p className="font-medium">
                                        {new Date(s.starts_at).toLocaleString(undefined, {
                                            weekday: "short",
                                            year: "numeric",
                                            month: "short",
                                            day: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        {" — "}
                                        {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "available"
                                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                                    : s.status === "booked"
                                                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                                        : "bg-gray-100 text-gray-700 ring-1 ring-gray-400/20"
                                                }`}
                                        >
                                            {s.status}
                                        </span>
                                        <span>Price: {gbFormatter.format((s.price_cents || 0) / 100)}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        disabled={s.status !== "available" || new Date(s.starts_at) <= new Date()}
                                        className={`inline-flex items-center rounded px-3 py-1.5 text-sm ${s.status !== "available" || new Date(s.starts_at) <= new Date()
                                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                                : "bg-red-600 text-white hover:bg-red-700"
                                            }`}
                                        title={
                                            s.status !== "available"
                                                ? "Only available slots can be deleted"
                                                : new Date(s.starts_at) <= new Date()
                                                    ? "Only future slots can be deleted"
                                                    : "Delete slot"
                                        }
                                    >
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {loading && (
                <div className="fixed inset-0 bg-black/10 backdrop-blur-sm grid place-items-center">
                    <div className="rounded-md bg-white px-4 py-3 text-sm shadow">Loading…</div>
                </div>
            )}
        </>
    );
}
