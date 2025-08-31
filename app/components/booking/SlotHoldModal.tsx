"use client";

/**
 * SlotHoldModal
 *  - calls /api/slots/[id]/hold on open
 *  - shows a 15-min countdown (from server response)
 *  - lets the user Cancel (calls /release) or Continue (you'll later send them to checkout)
 */

import { useEffect, useMemo, useState, useReducer } from "react";

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

export default function SlotHoldModal({ slotId, open, onClose, onContinue }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Optional slot summary we can show in success state
  const [slotSummary, setSlotSummary] = useState<SlotSummary | null>(null);

  // Flag once we successfully book (drives success UI)
  const [isBooked, setIsBooked] = useState(false);

  // Kick off the hold when the modal opens with a valid slotId
  useEffect(() => {
    let cancelled = false;

    async function hold() {
      if (!open || !slotId) return;
      setLoading(true);
      setError(null);
      setExpiresAt(null);

      try {
        const res = await fetch(`/api/slots/${slotId}/hold`, { method: "POST" });
        const data: HoldResp = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          const err = (data as { error?: string });
          setError(err.error ?? "Failed to hold slot");
        } else if ("hold_expires_at" in data) {
          setExpiresAt(new Date(data.hold_expires_at));
          // keep a lightweight snapshot for the success screen
          setSlotSummary({
            starts_at: data.slot.starts_at,
            ends_at: data.slot.ends_at,
            price_cents: data.slot.price_cents ?? null,
            tutor_id: data.slot.tutor_id,
          });
        }
      } catch {
        setError("Network error while holding the slot.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hold();
    return () => { cancelled = true; };
  }, [open, slotId]);

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
        await fetch(`/api/slots/${slotId}/release`, { method: "POST" });
      } catch { /* ignore */ }
    }
    // reset local state on close
    setBookingId(null);
    setIsBooked(false);
    setSlotSummary(null);
    setExpiresAt(null);
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
      const res = await fetch(`/api/slots/${slotId}/book`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError((data && data.error) || "Booking failed. Please try again.");
        return;
      }
      // success shape: { message: "Booked", booking: { id, ... }, slot: { ... } }
      const bId = data?.booking?.id as string | undefined;
      if (bId) setBookingId(bId);
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

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={!!error || loading || isBooking || !!bookingId}
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