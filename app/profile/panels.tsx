import CareerEditor from "./CareerEditor";
import { Availability, Compensation, Experience, Identity } from "./sections";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS, type Column } from "@/components/edit/columns";
import { accounts, career, criteria, education } from "@/lib/queries";
import type { Table } from "@/lib/schema";
import type { ReactNode } from "react";

type Panel = {
  title: string; tab?: string; sub?: string; covers?: string[]; body: () => ReactNode;
};

const BLURB: Record<string, string> = {
  identity: "The name, address, links and standing answers every form starts by asking for.",
  availability: "When you could start, and what you owe your current employer.",
  compensation: "What you would take, and what you are on now.",
};

const records = (table: Table, columns: Column[], rows: Record_[], what: string) => (
  <RecordList table={table} columns={columns} rows={rows} what={what} addLabel="Add" />
);

export const PANELS: Record<string, Panel> = {
  identity: { title: "Identity", sub: BLURB.identity, body: () => <Identity /> },
  availability: { title: "Availability", sub: BLURB.availability, body: () => <Availability /> },
  compensation: { title: "Compensation", sub: BLURB.compensation, body: () => <Compensation /> },

  career: {
    title: "Experience",
    tab: "Work history",
    sub: "Employers, the projects inside them, and the bullets a resume is built from. The years a"
      + " form asks for are counted off these dates.",
    covers: ["career", "experience"],
    body: () => <><Experience /><CareerEditor employers={career()} /></>,
  },
  education: {
    title: "Education",
    body: () => records("education", COLUMNS.education, education() as Record_[], "this degree"),
  },
  criteria: {
    title: "What you are looking for",
    tab: "Criteria",
    sub: "How a new opening gets scored. `kind` says how the scorer uses the row.",
    body: () => records("search_criteria", COLUMNS.criteria, criteria() as Record_[],
                        "this criterion"),
  },
  accounts: {
    title: "Accounts",
    sub: "Where an employer login lives. Never the password itself.",
    body: () => records("accounts", COLUMNS.accounts, accounts() as Record_[], "this account"),
  },
};

export const slugFor = (section: string) =>
  Object.entries(PANELS).find(([slug, panel]) => (panel.covers ?? [slug]).includes(section))?.[0]
  ?? section;
