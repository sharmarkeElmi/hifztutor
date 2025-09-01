"use client";

/**
 * SlotHoldModal
 *  - calls /api/slots/[id]/hold on open
 *  - shows a 15-min countdown (from server response)
 *  - lets the user Cancel (calls /release) or Continue (you'll later send them to checkout)
 */

import { useEffect, useMemo, useState, useReducer } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  slotId: string | null;
  open: boolean;
  onClose: () => void;
  onContinue?: (slotId: string, bookingId?: string) => void; // called after successful booking
};

type HoldResp =
  | {
      message: "Slot held";
      slot: {
        id: string;
        tutor_id: string;
        starts_at: string;
        ends_at: string;
        price_cents: number | null;
        held_by: string | null;
        hold_expires_at: string | null;
        status: string;
      };
      hold_expires_at: string; // ISO
    }
  | { error: string };

// Optional slot summary type for success state
type SlotSummary = {
  starts_at: string;
  ends_at: string;
  price_cents: number | null;
  tutor_id: string;
};

// Response shape for /api/slots/[id]/book
type BookResp = {
  error?: string;
  booking?: { id: string };
  slot?: {
    starts_at?: string;
    ends_at?: string;
    price_cents?: number | null;
    tutor_id?: string;
  };
};

export default function SlotHoldModal({ slotId, open, onClose, onContinue }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [held, setHeld] = useState(false);

  // Optional slot summary we can show in success state
  const [slotSummary, setSlotSummary] = useState<SlotSummary | null>(null);

  // Flag once we successfully book (drives success UI)
  const [isBooked, setIsBooked] = useState(false);

  const supabase = useMemo(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []
  );

  // Kick off the hold when the modal opens with a valid slotId
  useEffect(() => {
    let cancelled = false;
    if (!open || !slotId) return;

    // Abort the request if the modal closes/unmounts
    const controller = new AbortController();

    // reset per-open
    setLoading(true);
    setError(null);
    setExpiresAt(null);
    setHeld(false);
    setBookingId(null);
    setIsBooked(false);
    setSlotSummary(null);

    async function hold() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? null;

        console.log('[SlotHoldModal] client effect running:', typeof window !== 'undefined');
        console.log('[SlotHoldModal] session present:', Boolean(sessionData.session), 'sending bearer:', Boolean(accessToken));

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        console.log('[SlotHoldModal] hold headers keys:', Object.keys(headers));

        const res = await fetch(`/api/slots/${slotId}/hold`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers,
          signal: controller.signal,
        });

        // Explicit 401 handling to prompt sign-in
        if (res.status === 401) {
          if (!cancelled) {
            setHeld(false);
            setError("Please sign in to reserve this slot.");
          }
          return;
        }

        let data: HoldResp;
        try {
          data = await res.json();
        } catch {
          data = { error: "Unexpected response while holding the slot." };
        }

        if (cancelled) return;

        if (!res.ok || !("hold_expires_at" in data)) {
          const err = (data as { error?: string });
          setHeld(false);
          setError(err.error ?? "Failed to hold slot");
        } else {
          setExpiresAt(new Date(data.hold_expires_at));
          setSlotSummary({
            starts_at: data.slot.starts_at,
            ends_at: data.slot.ends_at,
            price_cents: data.slot.price_cents ?? null,
            tutor_id: data.slot.tutor_id,
          });
          setHeld(true);
        }
      } catch (e: unknown) {
        // Ignore abort errors from the fetch being cancelled on modal close/unmount
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        setError("Network error while holding the slot.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hold();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, slotId, supabase]);

  // Countdown mm:ss
  const countdown = useMemo(() => {
    if (!expiresAt) return "";
    const diffMs = expiresAt.getTime() - Date.now();
    if (diffMs <= 0) return "00:00";
    const mins = Math.floor(diffMs / 1000 / 60);
    const secs = Math.floor((diffMs / 1000) % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [expiresAt]);

  // Ticker for countdown
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      forceRender();
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Cancel = release the hold (best effort), then close
  const handleCancel = async () => {
    if (slotId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? null;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        console.log('[SlotHoldModal] release headers keys:', Object.keys(headers));

        await fetch(`/api/slots/${slotId}/release`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers,
        });
      } catch { /* ignore */ }
    }
    // reset local state on close
    setBookingId(null);
    setIsBooked(false);
    setSlotSummary(null);
    setExpiresAt(null);
    setHeld(false);
    setError(null);
    onClose();
  };

  const handleContinue = async () => {
    if (!slotId) return;
    // Optional: block if hold already expired
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      setError("Hold expired. Please pick the slot again.");
      return;
    }

    setIsBooking(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      console.log('[SlotHoldModal] book headers keys:', Object.keys(headers));

      const res = await fetch(`/api/slots/${slotId}/book`, {
        method: "POST",
        credentials: "include", // ensure auth cookies are sent
        cache: "no-store",
        headers,
      });

      // Explicit 401 handling to prompt sign-in
      if (res.status === 401) {
        setError("Please sign in to complete booking.");
        setIsBooking(false);
        return;
      }

      let data: BookResp;
      try {
        data = (await res.json()) as BookResp;
      } catch {
        data = { error: "Unexpected response while booking." };
      }

      if (!res.ok || data?.error) {
        setError(data?.error || "Booking failed. Please try again.");
        return;
      }

      // success shape: { message: "Booked", booking: { id, ... }, slot: { ... } }
      const bId = data?.booking?.id;
      if (bId) setBookingId(bId);

      // If API returned slot details, capture them for the success UI
      if (data.slot && data.slot.starts_at && data.slot.ends_at) {
        setSlotSummary({
          starts_at: data.slot.starts_at,
          ends_at: data.slot.ends_at,
          price_cents: data.slot.price_cents ?? null,
          tutor_id: data.slot.tutor_id ?? "",
        });
      }

      // Switch UI into a success state and stop the countdown
      setIsBooked(true);
      setExpiresAt(null);

      // Still notify parent if they want to route to checkout/lessons
      if (onContinue) onContinue(slotId, bId);
    } catch {
      setError("Network error while booking the slot.");
    } finally {
      setIsBooking(false);
    }
  };

  if (!open || !slotId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />

      {/* Panel */}
      <div className="relative z-[101] w-full max-w-md rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
        {!isBooked ? (
          <>
            <h3 className="text-lg font-semibold">Reserve this time</h3>

            <p className="mt-2 text-sm text-gray-600">
              We&apos;re holding this slot for you while you complete booking.
              {expiresAt && (
                <>
                  {" "}Hold expires in{" "}
                  <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-emerald-700">
                    {countdown}
                  </span>.
                </>
              )}
            </p>

            {loading && (
              <div className="mt-4 rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
                Holding the slot…
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {bookingId && (
              <div className="mt-4 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-700">
                Booking confirmed. Reference: <span className="font-mono">{bookingId}</span>
              </div>
            )}

            {!loading && !error && !held && (
              <div className="mt-3 text-xs text-gray-500">
                Preparing your hold… one moment.
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={!held || !!error || loading || isBooking || !!bookingId}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isBooking ? "Booking…" : "Continue"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">You’re booked in! 🎉</h3>
            <p className="mt-2 text-sm text-gray-600">
              We reserved this lesson successfully.
            </p>

            <div className="mt-4 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-800">
              <div>
                <span className="font-medium">Reference:</span>{" "}
                <span className="font-mono">{bookingId}</span>
              </div>
              {slotSummary && (
                <div className="mt-1 text-emerald-900">
                  <span className="font-medium">When:</span>{" "}
                  {new Date(slotSummary.starts_at).toLocaleString()} – {new Date(slotSummary.ends_at).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={handleCancel}
                className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => onContinue && slotId && onContinue(slotId, bookingId ?? undefined)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Go to My Lessons
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}