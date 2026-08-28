import FilterableTable from "@/components/FilterableTable";
import { Out, PageHeader, Stamp } from "@/components/ui";
import { companies } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Company = {
  slug: string; ats: string; name: string; active: number;
  careers_url: string | null; cadence: string | null; last_checked: string | null;
};

const DUE_AFTER: Record<string, number> = { Weekly: 7, Monthly: 30, Quarterly: 91 };

function checked(company: Company) {
  if (company.ats !== "manual") return { text: "—", due: false };
  if (!company.last_checked) return { text: "never checked", due: true };
  const days = Math.floor((Date.now() - Date.parse(company.last_checked)) / 86_400_000);
  const due = days >= (DUE_AFTER[company.cadence ?? ""] ?? 30);
  return { text: due ? `${days}d — due` : `${days}d ago`, due };
}

export default function SourcesPage() {
  const rows = companies() as Company[];
  const counts: Record<string, number> = {};
  for (const company of rows) counts[company.ats] = (counts[company.ats] ?? 0) + 1;

  return (
    <>
      <PageHeader
        title="Sources"
        sub={`${rows.filter((c) => c.active).length} active boards of ${rows.length} tracked.`}
      />
      <FilterableTable
        placeholder="company"
        empty="No boards tracked yet."
        head={[
          { label: "Company" }, { label: "Source" }, { label: "Cadence", hideNarrow: true },
          { label: "Last checked" }, { label: "Active" }, { label: "Careers", hideNarrow: true },
        ]}
        groups={[
          {
            name: "ats",
            facets: Object.keys(counts).sort((a, b) => counts[b] - counts[a])
              .map((ats) => ({ key: ats, label: ats, count: counts[ats] })),
          },
          {
            name: "state",
            facets: [
              { key: "due", label: "due to check", count: rows.filter((c) => checked(c).due).length },
              { key: "off", label: "inactive", count: rows.filter((c) => !c.active).length },
            ],
          },
        ]}
        rows={rows.map((company) => {
          const seen = checked(company);
          return {
            key: company.slug,
            facets: [company.ats, ...(seen.due ? ["due"] : []), ...(company.active ? [] : ["off"])],
            haystack: company.name,
            cells: [
              <span key="n" className="font-medium">{company.name}</span>,
              <Stamp key="a">{company.ats}</Stamp>,
              company.cadence || "—",
              <span key="c" className={seen.due ? "text-bad" : "text-dim"}>{seen.text}</span>,
              company.active ? "✓" : <span key="o" className="text-dim">off</span>,
              <Out key="u" href={company.careers_url}>open</Out>,
            ],
          };
        })}
      />
    </>
  );
}
