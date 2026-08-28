import CareerEditor from "./CareerEditor";
import {
  Availability, Compensation, Demographics, Experience, Identity, Search, WorkAuthorization,
} from "./sections";
import RecordList, { type Record_ } from "@/components/edit/RecordList";
import { COLUMNS, type Column } from "@/components/edit/columns";
import { accounts, career, criteria, education, facts, limits, notes } from "@/lib/queries";
import type { Table } from "@/lib/schema";
import type { ReactNode } from "react";

type Panel = { title: string; tab?: string; sub?: string; body: () => ReactNode };

const BLURB: Record<string, string> = {
  identity: "The name, address and links every form starts by asking for.",
  work_authorization: "Whether you can work somewhere, and whether you would need sponsoring.",
  availability: "When you could start, and what you owe your current employer.",
  compensation: "What you would take, and what you are on now.",
  demographics: "Optional on most forms. Answer only what you want reported.",
  experience: "The totals a form asks for as a number rather than a story.",
  search: "How you describe the job you want, in your own words.",
};

const records = (table: Table, columns: Column[], rows: Record_[], what: string) => (
  <RecordList table={table} columns={columns} rows={rows} what={what} addLabel="Add" />
);

export const PANELS: Record<string, Panel> = {
  identity: { title: "Identity", sub: BLURB.identity, body: () => <Identity /> },
  work_authorization: {
    title: "Work authorization", sub: BLURB.work_authorization,
    body: () => <WorkAuthorization />,
  },
  availability: { title: "Availability", sub: BLURB.availability, body: () => <Availability /> },
  compensation: { title: "Compensation", sub: BLURB.compensation, body: () => <Compensation /> },
  demographics: { title: "Demographics", sub: BLURB.demographics, body: () => <Demographics /> },
  experience: { title: "Experience", sub: BLURB.experience, body: () => <Experience /> },
  search: { title: "Search", sub: BLURB.search, body: () => <Search /> },

  career: {
    title: "Experience",
    tab: "Work history",
    sub: "Employers, the projects inside them, and the bullets a resume is built from.",
    body: () => <CareerEditor employers={career()} />,
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
  judgement: {
    title: "Judgement",
    sub: "What resists a schema, read on every scoring pass — this is what lets a case nobody"
      + " enumerated still get called right.",
    body: () => records("search_notes", COLUMNS.notes, notes() as Record_[], "this note"),
  },
  facts: {
    title: "Facts that must never be misreported",
    tab: "Facts",
    sub: "Corrections a resume may never contradict.",
    body: () => records("facts", COLUMNS.facts, facts() as Record_[], "this fact"),
  },
  accounts: {
    title: "Accounts",
    sub: "Where an employer login lives. Never the password itself.",
    body: () => records("accounts", COLUMNS.accounts, accounts() as Record_[], "this account"),
  },
  limits: {
    title: "What you have told companies",
    tab: "Told companies",
    sub: "So a later application cannot contradict an earlier one.",
    body: () => records("company_limits", COLUMNS.limits, limits() as Record_[], "this limit"),
  },
};
