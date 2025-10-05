"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@components/ui/button";

interface TimeOffModalProps {
  open: boolean;
  timezone: string;
  onCancel: () => void;
  onCreate: (payload: { start: Date; end: Date; reason: string }) => Promise<void>;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function TimeOffModal({ open, timezone, onCancel, onCreate }: TimeOffModalProps) {
  const defaultRange = useMemo(() => {
    const start = new Date();
    start.setMinutes(start.getMinutes() + 60);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }, []);

  const [startValue, setStartValue] = useState<string>(toLocalInputValue(defaultRange.start));
  const [endValue, setEndValue] = useState<string>(toLocalInputValue(defaultRange.end));
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60);
    now.setSeconds(0, 0);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setStartValue(toLocalInputValue(now));
    setEndValue(toLocalInputValue(end));
    setReason("");
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Please provide both start and end times.");
      return;
    }
    if (end <= start) {
      setError("End must be after start.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({ start, end, reason: reason.trim() });
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0D17]/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal
      aria-labelledby="timeoff-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-black bg-white p-6 shadow-2xl">
        <h2 id="timeoff-modal-title" className="text-xl font-bold text-[#111629]">Add time off</h2>
        <p className="mt-1 text-sm text-slate-500">Specify when you are unavailable. Students will not be able to book lessons during this time.</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">Timezone: {timezone}</p>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="timeoff-start" className="text-sm font-semibold text-[#111629]">Start</label>
            <input
              id="timeoff-start"
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111629] focus:border-[#D3F501] focus:outline-none focus:ring-2 focus:ring-[#D3F501]"
              value={startValue}
              onChange={(event) => setStartValue(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="timeoff-end" className="text-sm font-semibold text-[#111629]">End</label>
            <input
              id="timeoff-end"
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111629] focus:border-[#D3F501] focus:outline-none focus:ring-2 focus:ring-[#D3F501]"
              value={endValue}
              onChange={(event) => setEndValue(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="timeoff-reason" className="text-sm font-semibold text-[#111629]">Reason <span className="text-xs text-slate-400">(optional)</span></label>
            <textarea
              id="timeoff-reason"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111629] focus:border-[#D3F501] focus:outline-none focus:ring-2 focus:ring-[#D3F501]"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Travelling, personal appointment"
            />
          </div>
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-[#111629] hover:bg-slate-50"
              disabled={saving}
            >
              Cancel
            </button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add time off"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
