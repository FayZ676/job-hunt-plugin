"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { find, type Ran } from "@/lib/web/run";
import type { Since } from "@/lib/core/sources";
import { Card, Section, Sheet } from "@/components/ui";

const lines = (held: string) =>
  held
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default function Search({ windows }: { windows: readonly Since[] }) {
  const router = useRouter();
  const [terms, setTerms] = useState("");
  const [locations, setLocations] = useState("");
  const [remote, setRemote] = useState(false);
  const [since, setSince] = useState<Since>("7d");
  const [max, setMax] = useState(200);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState<Ran | null>(null);

  const go = async () => {
    setBusy(true);
    setRan(null);
    setRan(await find({ terms: lines(terms), locations: lines(locations), remote, since, max }));
    setBusy(false);
    router.refresh();
  };

  return (
    <>
      <Section title="Search" sub="One paid call per run, billed per job returned.">
        <Card>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <label className="min-w-56 flex-1">
              <span className="eyebrow mb-0.5 block">Roles, one per line</span>
              <textarea
                className="quietbox"
                rows={3}
                value={terms}
                autoFocus
                placeholder="AI Engineer"
                onChange={(event) => setTerms(event.target.value)}
              />
            </label>

            <label className="min-w-56 flex-1">
              <span className="eyebrow mb-0.5 block">Locations, one per line</span>
              <textarea
                className="quietbox"
                rows={3}
                value={locations}
                placeholder="United States"
                onChange={(event) => setLocations(event.target.value)}
              />
            </label>

            <label className="w-24">
              <span className="eyebrow mb-0.5 block">Since</span>
              <select className="quietbox" value={since} onChange={(event) => setSince(event.target.value as Since)}>
                {windows.map((window) => (
                  <option key={window} value={window}>
                    {window}
                  </option>
                ))}
              </select>
            </label>

            <label className="w-24">
              <span className="eyebrow mb-0.5 block">Max</span>
              <input
                className="quietbox tnum"
                type="number"
                min={1}
                value={max}
                onChange={(event) => setMax(Number(event.target.value))}
              />
            </label>

            <label className="flex items-center gap-2 self-end py-1 text-sm">
              <input type="checkbox" checked={remote} onChange={(event) => setRemote(event.target.checked)} />
              Remote only
            </label>
          </div>

          <div className="mt-4">
            <button
              type="button"
              disabled={busy || !lines(terms).length}
              onClick={go}
              className="rounded-field border border-base-content bg-base-content px-2.5 py-1
                      text-xs text-base-100 transition-opacity disabled:opacity-40"
            >
              {busy ? "Searching…" : "Search"}
            </button>
          </div>
        </Card>
      </Section>

      {ran && "error" in ran && (
        <Section title="Failed">
          <Card readout>
            <p className="font-mono text-xs text-error">{ran.error}</p>
          </Card>
        </Section>
      )}

      {ran && "found" in ran && (
        <Section title="This run">
          <Sheet
            readout
            bands={[
              {
                notes: [
                  { label: "Fetched", value: `${ran.found.fetched} postings, ${ran.found.fresh} new` },
                  { label: "Kept", value: `${ran.found.kept} of ${ran.found.examined} ruled` },
                  ...Object.entries(ran.found.counts)
                    .filter(([, n]) => n)
                    .map(([name, n]) => ({ label: name, value: String(n) })),
                  ran.found.unkeepable.length > 0 && {
                    label: "Unkeepable",
                    value: `${ran.found.unkeepable.join(", ")} — paid for, then dropped by title_include`,
                  },
                ],
              },
            ]}
          />
        </Section>
      )}
    </>
  );
}
