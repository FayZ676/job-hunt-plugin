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
    <div className="toast toast-center toast-bottom z-50">
      <div role="status" className={`alert ${note.bad ? "alert-error" : "alert-info"}`}>
        {note.message}
      </div>
    </div>
  );
}
