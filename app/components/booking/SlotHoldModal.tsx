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
  onContinue?: (slotId: string) => void; // e.g. navigate to /checkout later
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

export default function SlotHoldModal({ slotId, open, onClose, onContinue }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);

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
    onClose();
  };

  const handleContinue = async () => {
    if (!slotId) return;
    if (onContinue) onContinue(slotId);
    // later you might router.push(`/checkout?slot=${slotId}`)
  };

  if (!open || !slotId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleCancel} />

      {/* Panel */}
      <div className="relative z-[101] w-full max-w-md rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl">
        <h3 className="text-lg font-semibold">Reserve this time</h3>

        <p className="mt-2 text-sm text-gray-600">
          Were holding this slot for you while you complete booking.
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

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!!error || loading}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}