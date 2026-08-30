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

function headline(due: number, watched: number) {
  if (due === 0) {
    return watched === 0
      ? <>Nothing is on your watchlist.</>
      : <>Nothing needs you. The search covers the rest.</>;
  }
  return <>
    <span className="tnum">{due}</span>
    {due === 1 ? " company is" : " companies are"} due a look by hand.
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
      <ScreenHead kicker="Sources" headline={headline(due.length, automatic.length)}>
        <p className="mt-3 text-sm text-soft">
          Every posting comes from one search across 175,000 career sites, so a company need not be
          listed here to be found. These are watched by name whatever the title:{" "}
          <span className="tnum font-mono">{automatic.length}</span> searched
          {manual.length > 0 &&
            <> · <span className="tnum font-mono">{manual.length}</span> you check by hand</>}
          {paused > 0 && <> · <span className="tnum font-mono">{paused}</span> paused</>}
        </p>
      </ScreenHead>

      <Section
        title="Companies you check by hand"
        sub="The search has never turned these up. Open the careers page yourself on the cadence
             you set — and if the search starts finding them, delete the row."
      >
        <DataTable
          head={[
            { label: "Company" }, { label: "Cadence" }, { label: "Last checked" },
            { label: "Careers", hideNarrow: true },
            ...(paused > 0 ? [{ label: "Active" }] : []),
          ]}
          empty="No companies are checked by hand."
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
        title="Companies the search watches"
        sub="Searched by name, so their openings arrive whatever the title. Nothing here needs you."
      >
        <FilterableTable
          placeholder="company"
          empty="No companies are watched by name yet."
          head={[
            { label: "Company" }, { label: "Board" },
            ...(paused > 0 ? [{ label: "Active" }] : []),
          ]}
          groups={[{
            name: "ats",
            legend: "Filter companies by where their board lives",
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
