import CareerEditor from "./CareerEditor";
import { Identity, Instructions } from "./sections";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS, type Column } from "@/components/edit/columns";
import { career, education } from "@/lib/web/queries";
import type { Table } from "@/lib/core/schema";
import type { ReactNode } from "react";
import { BriefcaseBusiness, GraduationCap, IdCard, NotebookPen, type LucideIcon } from "lucide-react";

type Panel = {
  tab: string;
  covers?: string[];
  icon: LucideIcon;
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
    covers: ["career", "experience"],
    icon: BriefcaseBusiness,
    body: () => <CareerEditor employers={career()} />,
  },
  education: {
    tab: "Education",
    icon: GraduationCap,
    body: () => records("education", COLUMNS.education, education() as Record_[], "this degree", "Add a degree"),
  },

  instructions: {
    tab: "Instructions",
    icon: NotebookPen,
    body: () => <Instructions />,
  },
};

export const slugFor = (section: string) =>
  Object.entries(PANELS).find(([slug, panel]) => (panel.covers ?? [slug]).includes(section))?.[0] ?? section;
