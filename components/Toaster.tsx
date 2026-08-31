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
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div role="status"
           className={`rounded-box border px-3 py-2 text-sm shadow-sm ${note.bad
             ? "border-error bg-error text-error-content"
             : "border-base-content bg-base-content text-base-100"}`}>
        {note.message}
      </div>
    </div>
  );
}
