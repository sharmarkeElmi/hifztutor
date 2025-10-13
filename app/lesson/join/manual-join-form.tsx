"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ManualJoinFormProps = {
  className?: string;
  defaultRoom?: string | null;
};

export function ManualJoinForm({ className, defaultRoom }: ManualJoinFormProps) {
  const [roomName, setRoomName] = useState(defaultRoom ?? "");
  useEffect(() => {
    if (defaultRoom) {
      setRoomName(defaultRoom);
    }
  }, [defaultRoom]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = roomName.trim();
    if (!trimmed) {
      setError("Please enter a room name.");
      return;
    }

    setError(null);
    router.push(`/lesson/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className={["mt-4 max-w-md space-y-3", className].filter(Boolean).join(" ")}>
      <div>
        <label htmlFor="roomName" className="block text-sm font-medium text-[#111629]">
          Room name
        </label>
        <input
          id="roomName"
          name="roomName"
          type="text"
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
          placeholder="e.g. ustadh-ali-saturday-5pm"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-[#111629] shadow-sm focus:border-[#F7D250] focus:outline-none focus:ring-2 focus:ring-[#F7D250]/60"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="inline-flex items-center rounded px-4 py-2 text-sm font-medium text-[#111629]"
        style={{ backgroundColor: "#F7D250" }}
      >
        Join lesson
      </button>
    </form>
  );
}
