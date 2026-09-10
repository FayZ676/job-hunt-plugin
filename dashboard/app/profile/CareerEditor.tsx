"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import Adder from "@/components/edit/Adder";
import Chips from "@/components/edit/Chips";
import { useRemove } from "@/components/edit/DeleteButton";
import Field from "@/components/edit/Field";
import { COLUMNS, type Column } from "@/components/edit/columns";
import Glyph from "@/components/Glyph";
import { Options, useRightClick } from "@/components/Options";
import { Mark, Row } from "@/components/ui";
import { lengthLabel, monthsBetween, spanLabel, today, when, type When } from "@/components/format";
import type { Employer, Project } from "@/lib/web/queries";

type Held = { kind: "employer" | "project"; rowid: number };

const matches = (one: Held | undefined, kind: Held["kind"], rowid: number) => one?.kind === kind && one.rowid === rowid;

const fields = (row: unknown) => row as unknown as Record<string, unknown>;

const editing = (table: string, rowid: number, values: Record<string, unknown>) => (column: Column) => (
  <Field table={table} rowid={rowid} column={column} value={(values[column.name] ?? null) as string | number | null} />
);

const thin = (employer: Employer) => employer.projects.filter((project) => !project.about).length;

const Span = ({ table, rowid, values }: { table: string; rowid: number; values: Record<string, unknown> }) => {
  const edit = editing(table, rowid, values);
  const mono = "font-mono text-xs";
  return (
    <span className="flex max-w-64 items-baseline gap-2">
      <span className="w-28">{edit({ name: "start", label: "start", className: mono, placeholder: "2024-06" })}</span>
      <span aria-hidden className="text-soft">
        –
      </span>
      <span className="w-28">{edit({ name: "finish", label: "finish", className: mono, placeholder: "now" })}</span>
    </span>
  );
};

const Block = ({ label, children }: { label: string; children: ReactNode }) => (
  <section>
    <h3 className="eyebrow mb-1.5">{label}</h3>
    {children}
  </section>
);

const Body = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-x-12 gap-y-7 xl:grid-cols-[minmax(0,72ch)_minmax(16rem,1fr)]">{children}</div>
);

const Head = ({ name, meta }: { name: ReactNode; meta: (string | null)[] }) => (
  <header className="border-b border-base-300 pb-3">
    <div className="min-w-0">{name}</div>
    <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 pl-1.5 text-xs text-soft">
      {meta.filter(Boolean).map((part) => (
        <span key={part} className="tnum whitespace-nowrap">
          {part}
        </span>
      ))}
    </p>
  </header>
);

const NAME = "font-display text-2xl font-medium";

function EmployerDetail({ employer }: { employer: Employer }) {
  const values = fields(employer);
  const edit = editing("employers", employer.rowid, values);
  const start = when(employer.start);
  const current = !employer.finish;
  const finish = when(employer.finish);

  return (
    <div className="space-y-7">
      <Head
        name={edit({
          name: "name",
          label: "employer",
          required: true,
          className: NAME,
          placeholder: "Who employed you",
        })}
        meta={[
          employer.title,
          spanLabel(start, finish, current),
          start ? lengthLabel(monthsBetween(start, current ? today() : (finish ?? start))) : null,
        ]}
      />

      <Body>
        <Block label="About">
          {edit({
            name: "about",
            kind: "area",
            preview: true,
            className: "max-w-[72ch]",
            placeholder: "The company, your team, and what you owned there.",
          })}
        </Block>

        <aside className="space-y-6">
          <Block label="Your title">{edit({ name: "title", label: "your title", className: "max-w-64" })}</Block>
          <Block label="When">
            <Span table="employers" rowid={employer.rowid} values={values} />
          </Block>
        </aside>
      </Body>
    </div>
  );
}

function ProjectDetail({ project, employer }: { project: Project; employer: Employer }) {
  const values = fields(project);
  const edit = editing("projects", project.rowid, values);

  return (
    <div className="space-y-7">
      <Head
        name={edit({
          name: "name",
          label: "project",
          required: true,
          className: NAME,
          placeholder: "Name this project",
        })}
        meta={[employer.name, spanLabel(when(project.start), when(project.finish), false)]}
      />

      <Body>
        <Block label="About">
          {edit({
            name: "about",
            kind: "area",
            preview: true,
            className: "max-w-[72ch]",
            placeholder: "What you built, what changed because of it, and the numbers you can back up.",
          })}
        </Block>

        <aside className="space-y-6">
          <Block label="When">
            <Span table="projects" rowid={project.rowid} values={values} />
          </Block>
          <Block label="Technologies">
            <Chips
              table="project_technologies"
              column="technology"
              rows={project.technologies}
              seed={{ project_id: String(project.rowid) }}
              placeholder="add one, press enter"
            />
          </Block>
        </aside>
      </Body>
    </div>
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

function Spine({ employers, held, onHold }: { employers: Employer[]; held: Held; onHold: (next: Held) => void }) {
  const drop = useRemove();
  const { held: raised, open: raise, close: lower } = useRightClick<Held>();
  const doomed = locate(employers, raised?.key ?? null);

  const discard = () => {
    if (!doomed) return;
    const { employer, project } = doomed;
    if (!project)
      return drop("employers", employer.rowid, `${employer.name} and its ${employer.projects.length} projects`);
    drop("projects", project.rowid, project.name, () => {
      if (matches(held, "project", project.rowid)) onHold({ kind: "employer", rowid: employer.rowid });
    });
  };

  return (
    <nav aria-label="Career">
      {employers.map((employer, place) => {
        const here = matches(held, "employer", employer.rowid);
        const inside = (project: Project) => matches(held, "project", project.rowid);
        const open = here || employer.projects.some(inside);
        const start = opened(employer);
        const covered = start ? covering(employers, start) : null;
        const idle = start && covered ? monthsBetween(covered, start) : 0;
        const short = thin(employer);

        return (
          <Fragment key={employer.rowid}>
            <div className={`border-l-2 py-1 not-first:mt-1 ${open ? "border-base-content" : "border-base-300"}`}>
              <Row
                roomy
                on={here || matches(raised?.key, "employer", employer.rowid)}
                className={here ? "font-medium" : ""}
                aria-current={here}
                onClick={() => onHold({ kind: "employer", rowid: employer.rowid })}
                onContextMenu={(event) => raise({ kind: "employer", rowid: employer.rowid }, event)}
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="self-center">
                    <Mark on={!employer.about} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{employer.name}</span>
                  {short > 0 && (
                    <span
                      className="tnum shrink-0 font-mono text-micro text-signal"
                      title={`${short} without an About`}
                    >
                      {short}
                    </span>
                  )}
                </span>
                {employer.title && (
                  <span className="mt-0.5 block truncate pl-3 text-xs text-soft">{employer.title}</span>
                )}
                <span className="tnum mt-0.5 block pl-3 font-mono text-micro text-soft">
                  {spanLabel(start, when(employer.finish), !employer.finish)}
                </span>
              </Row>

              {open && (
                <>
                  <ul className="mt-1">
                    {employer.projects.map((project) => (
                      <li key={project.rowid}>
                        <Row
                          roomy
                          on={inside(project) || matches(raised?.key, "project", project.rowid)}
                          aria-current={inside(project)}
                          onClick={() => onHold({ kind: "project", rowid: project.rowid })}
                          onContextMenu={(event) => raise({ kind: "project", rowid: project.rowid }, event)}
                          className={`flex items-baseline gap-1.5 pl-7 ${inside(project) ? "font-medium" : ""}`}
                        >
                          <span className="self-center">
                            <Mark on={!project.about} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        </Row>
                      </li>
                    ))}
                  </ul>
                  <div className="pl-4">
                    <Adder
                      table="projects"
                      columns={[COLUMNS.projects[0]]}
                      seed={{ employer_id: String(employer.rowid) }}
                      label="Add project"
                      onAdded={(rowid) => onHold({ kind: "project", rowid })}
                    />
                  </div>
                </>
              )}
            </div>

            {idle >= GAP_MONTHS && place > 0 && (
              <p className="tnum border-l-2 border-dashed border-base-300 py-2 pl-3 text-micro text-soft">
                {lengthLabel(idle)} with no role
              </p>
            )}
          </Fragment>
        );
      })}

      <Adder
        table="employers"
        columns={[COLUMNS.employers[0]]}
        label="Add an employer"
        onAdded={(rowid) => onHold({ kind: "employer", rowid })}
      />

      {raised && doomed && (
        <Options
          at={raised.at}
          onClose={lower}
          options={[
            {
              key: "delete",
              label: doomed.project ? "Delete project" : "Delete employer",
              tone: "grave",
              icon: <Glyph icon={Trash2} size={13} />,
              onPick: discard,
            },
          ]}
        />
      )}
    </nav>
  );
}

function locate(employers: Employer[], held: Held | null) {
  if (!held) return null;
  for (const employer of employers) {
    if (held.kind === "employer") {
      if (employer.rowid === held.rowid) return { employer, project: null };
      continue;
    }
    const project = employer.projects.find((one) => one.rowid === held.rowid);
    if (project) return { employer, project };
  }
  return null;
}

export default function CareerEditor({ employers }: { employers: Employer[] }) {
  const [wanted, setWanted] = useState<Held | null>(null);

  const ordered = employers.slice().sort((left, right) => {
    const one = opened(left);
    const other = opened(right);
    if (one && other) return monthsBetween(one, other);
    return one ? -1 : other ? 1 : 0;
  });

  const found = locate(ordered, wanted);
  const at = found ?? (ordered.length ? { employer: ordered[0], project: null } : null);
  const held: Held = at?.project
    ? { kind: "project", rowid: at.project.rowid }
    : { kind: "employer", rowid: at?.employer.rowid ?? 0 };

  return (
    <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
      <div className="grid lg:grid-cols-[21rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="border-b border-base-300 p-2 lg:border-b-0 lg:border-r">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto">
            <Spine employers={ordered} held={held} onHold={setWanted} />
          </div>
        </div>

        <div className="min-w-0 p-5 md:p-7">
          {!at && (
            <p className="max-w-sm text-sm text-soft">
              Start with an employer. Every project, and every résumé built from them, hangs off one.
            </p>
          )}
          {at?.project && <ProjectDetail key={at.project.rowid} project={at.project} employer={at.employer} />}
          {at && !at.project && <EmployerDetail key={at.employer.rowid} employer={at.employer} />}
        </div>
      </div>
    </div>
  );
}
