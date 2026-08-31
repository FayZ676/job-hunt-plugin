import CareerEditor from "./CareerEditor";
import { Identity } from "./sections";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS, type Column } from "@/components/edit/columns";
import { career, education, experience } from "@/lib/queries";
import type { Table } from "@/lib/schema";
import type { ReactNode } from "react";
import { BriefcaseBusiness, GraduationCap, IdCard, type LucideIcon } from "lucide-react";

type Panel = {
  title?: string; tab: string; sub?: string; covers?: string[]; icon: LucideIcon;
  body: () => ReactNode;
};

const records = (table: Table, columns: Column[], rows: Record_[], what: string, add: string) => (
  <RecordList table={table} columns={columns} rows={rows} what={what} addLabel={add} />
);

export const PANELS: Record<string, Panel> = {
  identity: {
    tab: "Identity",
    icon: IdCard,
    body: () => <Identity />,
  },

  career: {
    tab: "Work history",
    sub: "Employers, the projects inside them, and the bullets a resume is built from. Every"
      + " application the app writes is assembled out of this page.",
    covers: ["career", "experience"],
    icon: BriefcaseBusiness,
    body: () => <CareerEditor employers={career()} experience={experience()} />,
  },
  education: {
    tab: "Education",
    sub: "Degrees, and the years forms ask you to confirm.",
    icon: GraduationCap,
    body: () => records("education", COLUMNS.education, education() as Record_[],
                        "this degree", "Add a degree"),
  },
};

export const slugFor = (section: string) =>
  Object.entries(PANELS).find(([slug, panel]) => (panel.covers ?? [slug]).includes(section))?.[0]
  ?? section;
