"use client";

import { Fragment } from "react";
import Adder from "@/components/edit/Adder";
import Chips from "@/components/edit/Chips";
import DeleteButton from "@/components/edit/DeleteButton";
import Field from "@/components/edit/Field";
import RecordList from "@/components/edit/RecordList";
import { COLUMNS, type Column } from "@/components/edit/columns";
import { Disclosure, Empty, Sheet, Stack, Stamp, type Note } from "@/components/ui";
import {
  lengthLabel, monthsBetween, spanLabel, today, when, type When,
} from "@/components/format";
import type { Employer, Project } from "@/lib/web/queries";

type Experience = { clock_starts: string | null; years: number | null; relevant_years: number | null };

const editing = (table: string, rowid: number, values: Record<string, unknown>) =>
  (column: Column) => (
    <Field table={table} rowid={rowid} column={column}
           value={(values[column.name] ?? null) as string | number | null} />
  );

const held = (row: unknown) => row as unknown as Record<string, unknown>;

const Span = ({ table, rowid, values }: {
  table: string; rowid: number; values: Record<string, unknown>;
}) => {
  const edit = editing(table, rowid, values);
  const mono = "font-mono text-xs";
  return (
    <span className="flex items-baseline gap-2">
      <span className="w-24">{edit({ name: "start", label: "start", className: mono,
                                     placeholder: "2024-06" })}</span>
      <span aria-hidden className="text-soft">–</span>
      <span className="w-24">{edit({ name: "finish", label: "finish", className: mono,
                                     placeholder: values.current ? "now" : "2025-03" })}</span>
    </span>
  );
};

const Trash = ({ table, rowid, what, says }: {
  table: string; rowid: number; what: string; says: string;
}) => (
  <div className="mt-6 flex items-center gap-2 text-xs text-soft">
    <DeleteButton table={table} rowid={rowid} what={what} />
    {says}
  </div>
);

function ProjectPanel({ project }: { project: Project }) {
  const seed = { project_id: String(project.rowid) };
  const values = held(project);
  const edit = editing("projects", project.rowid, values);
  const dates = spanLabel(when(project.start), when(project.finish), false);
  const bullets = project.bullets.length;

  return (
    <Disclosure
      mark={bullets === 0}
      summary={project.name}
      aside={
        <span className="flex shrink-0 items-baseline gap-4">
          {dates && <Stamp>{dates}</Stamp>}
          <span className={`tnum text-xs ${bullets === 0 ? "text-signal" : "text-soft"}`}>
            {bullets} bullet{bullets === 1 ? "" : "s"}
          </span>
        </span>
      }
    >
      <div className="space-y-6">
        <Sheet bands={[{
          notes: [
            { label: "Project", value: edit({ name: "name", required: true,
                                              className: "font-medium max-w-md" }) },
            { label: "Status", value: <span className="block max-w-48">
                {edit({ name: "status", vocabulary: "status" })}
              </span> },
            { label: "Ran", value: <Span table="projects" rowid={project.rowid} values={values} /> },
            { label: "What it was", value: edit({ name: "summary", kind: "area",
                label: "what it was", placeholder: "One sentence on what this project was." }) },
          ],
        }]} />

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h5 className="eyebrow">Bullets</h5>
            <p className="text-xs text-soft">
              A tailored resume draws on these sentences and no others.
            </p>
          </div>
          <RecordList
            table="project_bullets"
            columns={[COLUMNS.bullets[0]]}
            rows={project.bullets}
            seed={seed}
            what="this bullet"
            addLabel="Add bullet"
            empty="Nothing here yet. Until this project has a bullet, no resume can use it."
            ordered
          />
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h5 className="eyebrow">Technologies</h5>
            <p className="text-xs text-soft">What a job description is matched against.</p>
          </div>
          <Chips table="project_technologies" column="technology" rows={project.technologies}
                 seed={seed} placeholder="add one, then enter" />
        </section>

        <section>
          <h5 className="eyebrow mb-2">Metrics</h5>
          <RecordList table="project_metrics" columns={COLUMNS.metrics} rows={project.metrics}
                      seed={seed} what="this metric" addLabel="Add metric"
                      empty="Numbers you can stand behind land hardest on a resume." />
        </section>

        <section>
          <h5 className="eyebrow mb-2">Links</h5>
          <RecordList table="project_links" columns={COLUMNS.links} rows={project.links}
                      seed={seed} what="this link" addLabel="Add link" />
        </section>

        <section>
          <h5 className="eyebrow mb-2">Notes to yourself</h5>
          <Sheet bands={[{
            notes: [
              { label: "Shared with", value: edit({ name: "shared_with", label: "shared with",
                  placeholder: "Who else worked on it" }) },
              { label: "Notes", value: edit({ name: "notes", kind: "area",
                  placeholder: "Anything worth remembering when this comes up in an interview" }) },
            ],
          }]} />
        </section>

        <Trash table="projects" rowid={project.rowid} what={project.name}
               says="Delete this project and everything under it." />
      </div>
    </Disclosure>
  );
}

function EmployerPanel({ employer }: { employer: Employer }) {
  const values = held(employer);
  const edit = editing("employers", employer.rowid, values);
  const start = when(employer.start);
  const current = employer.current === 1;
  const finish = when(employer.finish);
  const length = start
    ? lengthLabel(monthsBetween(start, current ? today() : finish ?? start))
    : null;
  const thin = employer.projects.filter((project) => project.bullets.length === 0).length;

  return (
    <Disclosure
      mark={thin > 0}
      summary={employer.name}
      aside={
        <span className="hidden shrink-0 items-baseline gap-4 sm:flex">
          <span className="text-xs text-soft">{employer.title}</span>
          <Stamp>{spanLabel(start, finish, current)}</Stamp>
          {length && <span className="text-xs text-soft">{length}</span>}
        </span>
      }
    >
      <div className="space-y-6">
        <Sheet bands={[{
          notes: [
            { label: "Employer", value: edit({ name: "name", label: "employer", required: true,
                                               className: "font-medium max-w-md" }) },
            { label: "Your title", value: edit({ name: "title", label: "your title",
                placeholder: "Your title there", className: "max-w-md" }) },
            { label: "There", value: <Span table="employers" rowid={employer.rowid}
                                           values={values} /> },
            { label: "Still there", value: <span className="block max-w-32">
                {edit({ name: "current", label: "still there",
                        options: [["1", "still there"], ["0", "left"]], required: true })}
              </span> },
            { label: "What the company does", value: edit({ name: "context", kind: "area",
                label: "what the company does",
                placeholder: "What does this company do? One or two lines is plenty." }) },
          ],
        }]} />

        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <h5 className="eyebrow">Projects</h5>
            <p className="text-xs text-soft">
              A project is one piece of work, with the bullets that describe it.
            </p>
          </div>
          <Stack foot={<Adder table="projects" columns={COLUMNS.projects}
                              seed={{ employer_id: String(employer.rowid) }} label="Add project" />}>
            {employer.projects.length === 0 && (
              <Empty>No projects here yet.</Empty>
            )}
            {employer.projects.map((project) => (
              <ProjectPanel key={project.rowid} project={project} />
            ))}
          </Stack>
        </section>

        <Trash table="employers" rowid={employer.rowid} what={employer.name}
               says="Delete this employer, its projects and their bullets." />
      </div>
    </Disclosure>
  );
}

const opened = (employer: Employer) => when(employer.start);

function covering(employers: Employer[], mark: When): When | null {
  let latest: When | null = null;
  for (const employer of employers) {
    const start = opened(employer);
    if (!start || monthsBetween(start, mark) <= 0) continue;
    const ends = employer.current === 1 ? today() : when(employer.finish) ?? start;
    if (!latest || monthsBetween(latest, ends) > 0) latest = ends;
  }
  return latest;
}

const GAP_MONTHS = 4;

export default function CareerEditor({ employers, experience }: {
  employers: Employer[]; experience: Experience;
}) {
  const ordered = employers.slice().sort((left, right) => {
    const one = opened(left);
    const other = opened(right);
    if (one && other) return monthsBetween(one, other);
    return one ? -1 : other ? 1 : 0;
  });

  const projects = employers.reduce((sum, employer) => sum + employer.projects.length, 0);
  const bullets = employers.reduce((sum, employer) =>
    sum + employer.projects.reduce((count, project) => count + project.bullets.length, 0), 0);
  const thin = employers.flatMap((employer) => employer.projects)
    .filter((project) => project.bullets.length === 0).length;

  const summary: Note[] = [
    {
      label: "Years of experience",
      mark: experience.years === null,
      value: experience.years === null
        ? <span className="text-soft">
            No dates on file yet, so a form asking for years of experience has nothing to answer
            with.
          </span>
        : <>
            <span className="tnum font-medium">{experience.years} years</span>
            <span className="text-soft">
              , {experience.relevant_years} of them relevant, counted from{" "}
              {experience.clock_starts}. Correct a date below; there is no total to edit.
            </span>
          </>,
    },
    {
      label: "What a resume can draw on",
      mark: thin > 0,
      value: <span className="tnum">
        {employers.length} employers · {projects} projects · {bullets} bullets
        {thin > 0 && (
          <span className="text-signal">
            {" · "}{thin} project{thin === 1 ? "" : "s"} with no bullet
          </span>
        )}
      </span>,
    },
  ];

  return (
    <div className="space-y-4">
      <Sheet readout bands={[{ notes: summary }]} />

      <Stack foot={<Adder table="employers" columns={COLUMNS.employers} label="Add an employer"
                          hint="Where you worked, what you were called, and when" />}>
        {ordered.length === 0 && (
          <Empty>No employers yet.</Empty>
        )}
        {ordered.map((employer) => {
          const start = opened(employer);
          const covered = start ? covering(ordered, start) : null;
          const idle = start && covered ? monthsBetween(covered, start) : 0;
          return (
            <Fragment key={employer.rowid}>
              <EmployerPanel employer={employer} />
              {idle >= GAP_MONTHS && (
                <p className="border-b border-base-200 px-3 py-2 text-xs text-soft last:border-0">
                  {lengthLabel(idle)} with no role recorded
                </p>
              )}
            </Fragment>
          );
        })}
      </Stack>
    </div>
  );
}
