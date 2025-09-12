"use client";

export default function InboxPage() {
  return (
    <div className="hidden md:grid flex-1 place-items-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-[#111629]">Messages</h1>
        <p className="mt-1 text-slate-500">Pick a conversation from the left to start chatting.</p>
      </div>
    </div>
  );
}
