"use client";

/**
 * Lesson Join Page
 * -----------------------------------------
 * MVP flow for joining a LiveKit room.
 * 
 * Responsibilities:
 *  - Let user type in a Room Name (text input).
 *  - Redirect to /lesson/[roomName] when they click Join.
 *  - Protects against empty room names.
 * 
 * Future:
 *  - This manual input will be replaced with a "Join" button
 *    from the user's scheduled lessons.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinLessonPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");

  // Handle Join button click
  const handleJoin = () => {
    if (!roomName.trim()) {
      alert("Please enter a room name.");
      return;
    }
    // Navigate to dynamic route: /lesson/[roomName]
    router.push(`/lesson/${roomName}`);
  };

  return (
    <section className="max-w-md mx-auto mt-10 space-y-6">
      <h1 className="text-2xl font-semibold text-center">
        Join a Live Lesson
      </h1>

      {/* Room Name Input */}
      <div>
        <label htmlFor="roomName" className="block text-sm font-medium">
          Room Name
        </label>
        <input
          id="roomName"
          type="text"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Enter your lesson room name"
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Join Button */}
      <button
        onClick={handleJoin}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        Join Lesson
      </button>
    </section>
  );
}