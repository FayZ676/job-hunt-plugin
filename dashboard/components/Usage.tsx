"use client";

import { useEffect, useState } from "react";
import type { Usage } from "@/lib/web/usage";

const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const tone = (used: number) => (used >= 90 ? "text-error" : used >= 75 ? "text-warning" : "text-soft");

const lasting = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const stale = 10 * 60 * 1000;

export default function Usage({ usage }: { usage: Usage }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const { five, week, at } = usage;
  const spans = [{ label: "5-hour", span: five }, ...(week ? [{ label: "Weekly", span: week }] : [])];

  const tip = spans
    .map(({ label, span }) => {
      const left = now === null ? "" : `, resets in ${lasting(span.resets * 1000 - now)}`;
      return `${label} ${Math.round(span.used)}% used${left}`;
    })
    .concat(now !== null && now - at > stale ? [`Last seen ${lasting(now - at)} ago`] : [])
    .join("\n");

  return (
    <span data-tip={tip} className="tooltip tooltip-left shrink-0 before:whitespace-pre before:text-micro">
      <span
        aria-label={tip.replace(/\n/g, ". ")}
        className={`flex items-center rounded-field p-1.5 ${tone(five.used)}`}
      >
        <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="shrink-0 -rotate-90">
          <circle cx="8" cy="8" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          <circle
            cx="8"
            cy="8"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(100, five.used) / 100)}
          />
        </svg>
      </span>
    </span>
  );
}
