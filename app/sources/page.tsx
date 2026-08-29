import FilterableTable from "@/components/FilterableTable";
import { shortDate } from "@/components/format";
import { DataTable, Out, ScreenHead, Section, Stamp } from "@/components/ui";
import { companies, type Company } from "@/lib/queries";

export const dynamic = "force-dynamic";

const DUE_AFTER: Record<string, number> = { Weekly: 7, Monthly: 30, Quarterly: 91 };

function checked(company: Company) {
  if (!company.last_checked) return { text: "never checked", due: true };
  const days = Math.floor((Date.now() - Date.parse(company.last_checked)) / 86_400_000);
  const due = days >= (DUE_AFTER[company.cadence ?? ""] ?? 30);
  return { text: due ? `due — last ${shortDate(company.last_checked)}` : `${days}d ago`, due };
}

function headline(due: number, manual: number) {
  if (due === 0) {
    return manual === 0
      ? <>Every board is scanned for you.</>
      : <>No board is due a check.</>;
  }
  return <>
    <span className="tnum">{due}</span>
    {due === 1 ? " board is" : " boards are"} due a look.
  </>;
}

export default function SourcesPage() {
  const all = companies();
  const manual = all.filter((company) => company.ats === "manual");
  const automatic = all.filter((company) => company.ats !== "manual");
  const due = manual.filter((company) => company.active && checked(company).due);
  const paused = all.filter((company) => !company.active).length;

  const counts: Record<string, number> = {};
  for (const company of automatic) counts[company.ats] = (counts[company.ats] ?? 0) + 1;

  return (
    <>
      <ScreenHead kicker="Sources" headline={headline(due.length, manual.length)}>
        <p className="mt-3 text-sm text-soft">
          <span className="tnum font-mono">{automatic.length}</span> boards the scan reads on its
          own · <span className="tnum font-mono">{manual.length}</span> you check by hand
          {paused > 0 && <> · <span className="tnum font-mono">{paused}</span> paused</>}
        </p>
      </ScreenHead>

      <Section
        title="Boards you check by hand"
        sub="No API to read, so the scan cannot see these. Open the careers page yourself on the
             cadence you set."
      >
        <DataTable
          head={[
            { label: "Company" }, { label: "Cadence" }, { label: "Last checked" },
            { label: "Careers", hideNarrow: true },
            ...(paused > 0 ? [{ label: "Active" }] : []),
          ]}
          empty="No boards are checked by hand."
          rows={manual
            .map((company) => ({ company, seen: checked(company) }))
            .sort((left, right) =>
              Number(right.seen.due && right.company.active) -
                Number(left.seen.due && left.company.active) ||
              left.company.name.localeCompare(right.company.name))
            .map(({ company, seen }) => ({
              key: company.slug,
              cells: [
                <span key="n" className="font-medium">{company.name}</span>,
                company.cadence || <span key="c" className="text-soft">not set</span>,
                <span key="l" className="flex items-center gap-1.5">
                  {seen.due && company.active &&
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-signal" />}
                  <span className={seen.due && company.active ? "" : "text-soft"}>{seen.text}</span>
                </span>,
                <Out key="u" href={company.careers_url}>open</Out>,
                ...(paused > 0
                  ? [company.active ? "yes" : <span key="o" className="text-soft">paused</span>]
                  : []),
              ],
            }))}
        />
      </Section>

      <Section
        title="Boards the scan reads"
        sub="These have an API behind them. Nothing here needs you."
      >
        <FilterableTable
          placeholder="company"
          empty="No automatic boards tracked yet."
          head={[
            { label: "Company" }, { label: "Source" },
            ...(paused > 0 ? [{ label: "Active" }] : []),
          ]}
          groups={[{
            name: "ats",
            legend: "Filter boards by source",
            facets: Object.keys(counts).sort((a, b) => counts[b] - counts[a])
              .map((ats) => ({ key: ats, label: ats, count: counts[ats] })),
          }]}
          rows={automatic.map((company) => ({
            key: company.slug,
            facets: [company.ats],
            haystack: company.name,
            cells: [
              <span key="n" className="font-medium">{company.name}</span>,
              <Stamp key="a">{company.ats}</Stamp>,
              ...(paused > 0
                ? [company.active ? "yes" : <span key="o" className="text-soft">paused</span>]
                : []),
            ],
          }))}
        />
      </Section>
    </>
  );
}
