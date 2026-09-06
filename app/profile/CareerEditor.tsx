"use client";

import { Fragment } from "react";
import Adder from "@/components/edit/Adder";
import Chips from "@/components/edit/Chips";
import DeleteButton from "@/components/edit/DeleteButton";
import Field from "@/components/edit/Field";
import { COLUMNS, type Column } from "@/components/edit/columns";
import { Disclosure, Empty, Sheet, Stack, Stamp } from "@/components/ui";
import { lengthLabel, monthsBetween, spanLabel, today, when, type When } from "@/components/format";
import type { Employer, Project } from "@/lib/web/queries";

const editing = (table: string, rowid: number, values: Record<string, unknown>) => (column: Column) => (
  <Field table={table} rowid={rowid} column={column} value={(values[column.name] ?? null) as string | number | null} />
);

const held = (row: unknown) => row as unknown as Record<string, unknown>;

const Span = ({ table, rowid, values }: { table: string; rowid: number; values: Record<string, unknown> }) => {
  const edit = editing(table, rowid, values);
  const mono = "font-mono text-xs";
  return (
    <span className="flex items-baseline gap-2">
      <span className="w-24">{edit({ name: "start", label: "start", className: mono, placeholder: "2024-06" })}</span>
      <span aria-hidden className="text-soft">
        –
      </span>
      <span className="w-24">
        {edit({ name: "finish", label: "finish", className: mono, placeholder: "now" })}
      </span>
    </span>
  );
};

const Trash = ({ table, rowid, what, says }: { table: string; rowid: number; what: string; says: string }) => (
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

  return (
    <Disclosure
      mark={!project.about}
      summary={project.name}
      aside={<span className="flex shrink-0 items-baseline gap-4">{dates && <Stamp>{dates}</Stamp>}</span>}
    >
      <div className="space-y-6">
        <Sheet
          bands={[
            {
              notes: [
                { label: "Project", value: edit({ name: "name", required: true, className: "font-medium max-w-md" }) },
                { label: "Ran", value: <Span table="projects" rowid={project.rowid} values={values} /> },
                { label: "About", value: edit({ name: "about", kind: "area" }) },
                {
                  label: "Technologies",
                  value: (
                    <Chips
                      table="project_technologies"
                      column="technology"
                      rows={project.technologies}
                      seed={seed}
                      placeholder="add one, then enter"
                    />
                  ),
                },
              ],
            },
          ]}
        />

        <Trash
          table="projects"
          rowid={project.rowid}
          what={project.name}
          says="Delete this project and everything under it."
        />
      </div>
    </Disclosure>
  );
}

function EmployerPanel({ employer }: { employer: Employer }) {
  const values = held(employer);
  const edit = editing("employers", employer.rowid, values);
  const start = when(employer.start);
  const current = !employer.finish;
  const finish = when(employer.finish);
  const length = start ? lengthLabel(monthsBetween(start, current ? today() : (finish ?? start))) : null;
  const thin = employer.projects.filter((project) => !project.about).length;

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
        <Sheet
          bands={[
            {
              notes: [
                {
                  label: "Employer",
                  value: edit({ name: "name", label: "employer", required: true, className: "font-medium max-w-md" }),
                },
                { label: "Your title", value: edit({ name: "title", label: "your title", className: "max-w-md" }) },
                { label: "There", value: <Span table="employers" rowid={employer.rowid} values={values} /> },
                { label: "About", value: edit({ name: "about", kind: "area" }) },
              ],
            },
          ]}
        />

        <section>
          <Stack
            head="Project"
            foot={
              <Adder
                table="projects"
                columns={COLUMNS.projects}
                seed={{ employer_id: String(employer.rowid) }}
                label="Add project"
              />
            }
          >
            {employer.projects.length === 0 && <Empty>No projects here yet.</Empty>}
            {employer.projects.map((project) => (
              <ProjectPanel key={project.rowid} project={project} />
            ))}
          </Stack>
        </section>

        <Trash
          table="employers"
          rowid={employer.rowid}
          what={employer.name}
          says="Delete this employer and its projects."
        />
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
    const ends = when(employer.finish) ?? today();
    if (!latest || monthsBetween(latest, ends) > 0) latest = ends;
  }
  return latest;
}

const GAP_MONTHS = 4;

export default function CareerEditor({ employers }: { employers: Employer[] }) {
  const ordered = employers.slice().sort((left, right) => {
    const one = opened(left);
    const other = opened(right);
    if (one && other) return monthsBetween(one, other);
    return one ? -1 : other ? 1 : 0;
  });

  return (
    <div className="space-y-4">
      <Stack head="Employer" foot={<Adder table="employers" columns={COLUMNS.employers} label="Add an employer" />}>
        {ordered.length === 0 && <Empty>No employers yet.</Empty>}
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
