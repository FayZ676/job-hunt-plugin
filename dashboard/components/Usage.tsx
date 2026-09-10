"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Flyout, { useAnchored } from "./Flyout";
import { say } from "./Toaster";
import { answered } from "./edit/answered";
import { Ghost, Mark, Row } from "@/components/ui";
import { chooseModel } from "@/lib/edit";
import type { Model } from "@/lib/queries";
import type { Usage } from "@/lib/usage";

const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const SPENT = 80;

const lasting = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const stale = 10 * 60 * 1000;

const Span = ({ label, used, resets }: { label: string; used: number; resets: string | null }) => (
  <div className="px-3 py-2">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs">{label}</span>
      <span className={`tnum font-mono text-xs ${used >= SPENT ? "text-error" : "text-soft"}`}>
        {Math.round(used)}%
      </span>
    </div>
    <div className="mt-1.5 h-0.5 w-full rounded-full bg-rule">
      <div
        style={{ width: `${Math.min(100, used)}%` }}
        className={`h-0.5 rounded-full ${used >= SPENT ? "bg-error" : "bg-base-content"}`}
      />
    </div>
    {resets && <p className="mt-1.5 text-micro text-soft">Resets in {resets}</p>}
  </div>
);

export default function Usage({ usage, models, model }: { usage: Usage | null; models: Model[]; model: string }) {
  const router = useRouter();
  const { anchor, from, toggle, close } = useAnchored();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const pick = async (key: string) => {
    close();
    const result = await answered(chooseModel(key));
    if ("error" in result) return say(result.error, true);
    router.refresh();
  };

  const spent = usage?.five.used ?? 0;
  const spans = usage
    ? [{ label: "5-hour", span: usage.five }, ...(usage.week ? [{ label: "Weekly", span: usage.week }] : [])]
    : [];
  const legend = spans.map(({ label, span }) => `${label} ${Math.round(span.used)}% used`).join(", ");

  return (
    <>
      <Ghost
        ref={anchor}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={Boolean(from)}
        aria-label={legend ? `Usage and model — ${legend}` : "Usage and model"}
        icon={
          <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="shrink-0 -rotate-90">
            <circle cx="8" cy="8" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
            <circle
              cx="8"
              cy="8"
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={spent >= SPENT ? "text-error" : undefined}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(100, spent) / 100)}
            />
          </svg>
        }
      />

      {from && (
        <Flyout from={from} keep={anchor} onClose={close}>
          {spans.map(({ label, span }) => (
            <Span
              key={label}
              label={label}
              used={span.used}
              resets={now === null ? null : lasting(span.resets * 1000 - now)}
            />
          ))}

          {!usage && <p className="px-3 py-2 text-xs text-soft">No usage read yet.</p>}

          {usage && now !== null && now - usage.at > stale && (
            <p className="px-3 pb-2 text-micro text-soft">Last read {lasting(now - usage.at)} ago</p>
          )}

          <div className="mt-1 border-t border-base-300 pt-2">
            <h2 className="eyebrow px-3">Model</h2>
            <p className="px-3 pb-1 pt-0.5 text-micro text-soft">For conversations started here.</p>
            {models.map((choice) => {
              const on = model === choice.key;
              return (
                <Row
                  key={choice.key}
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => pick(choice.key)}
                  className={`flex items-center gap-2 ${on ? "font-medium text-base-content" : "text-soft"}`}
                >
                  <Mark on={on} />
                  {choice.label}
                </Row>
              );
            })}
          </div>
        </Flyout>
      )}
    </>
  );
}
