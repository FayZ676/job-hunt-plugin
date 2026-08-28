"use client";

import { useEffect, useState } from "react";

type Note = { message: string; bad: boolean; at: number };

export const say = (message: string, bad = false) =>
  window.dispatchEvent(new CustomEvent<Note>("job:say", {
    detail: { message, bad, at: Date.now() },
  }));

export default function Toaster() {
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    const heard = (event: Event) => setNote((event as CustomEvent<Note>).detail);
    window.addEventListener("job:say", heard);
    return () => window.removeEventListener("job:say", heard);
  }, []);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), note.bad ? 7000 : 1600);
    return () => clearTimeout(timer);
  }, [note]);

  if (!note) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-50 max-w-[80vw] -translate-x-1/2 rounded-full px-4 py-2
        text-sm shadow-lg ${note.bad ? "bg-bad text-white" : "bg-ink text-bg"}`}
    >
      {note.message}
    </div>
  );
}
