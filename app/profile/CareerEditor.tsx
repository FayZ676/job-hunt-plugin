"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { save } from "@/lib/actions";
import { answered } from "@/components/edit/answered";
import { say } from "@/components/Toaster";
import Adder from "@/components/edit/Adder";
import Chips from "@/components/edit/Chips";
import DeleteButton from "@/components/edit/DeleteButton";
import Field from "@/components/edit/Field";
import RecordList from "@/components/edit/RecordList";
import { COLUMNS, type Column } from "@/components/edit/columns";
import {
  lengthLabel, monthsBetween, spanLabel, today, when, whenLabel, type When,
} from "@/components/format";
import type { Bullet, Employer, Project } from "@/lib/queries";

type Experience = { clock_starts: string | null; years: number | null; relevant_years: number | null };

const BULLET_TARGET = 5;

const editing = (table: string, rowid: number, values: Record<string, unknown>) =>
  (column: Column) => (
    <Field table={table} rowid={rowid} column={{ quiet: true, ...column }}
           value={(values[column.name] ?? null) as string | number | null} />
  );

const Inline = ({ width, children }: { width: string; children: React.ReactNode }) => (
  <span className={`inline-block ${width}`}>{children}</span>
);

function BulletMark({ count }: { count: number }) {
  if (count === 0)
    return <span className="whitespace-nowrap text-xs text-signal">no bullets yet</span>;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-soft">
      <span aria-hidden className="flex gap-px">
        {Array.from({ length: BULLET_TARGET }, (_, slot) => (
          <span key={slot} className={`h-2.5 w-[3px] ${
            slot < Math.min(count, BULLET_TARGET) ? "bg-base-content" : "bg-base-300"}`} />
        ))}
      </span>
      <span className="tnum">{count}</span>
      <span className="sr-only">bullets</span>
    </span>
  );
}

function Dates({ table, rowid, values }: {
  table: string; rowid: number; values: Record<string, unknown>;
}) {
  const edit = editing(table, rowid, values);
  const mono = "font-mono text-xs";
  return (
    <>
      <Inline width="w-24">{edit({ name: "start", label: "start", className: mono,
                                   placeholder: "2024-06" })}</Inline>
      <span aria-hidden className="text-soft">–</span>
      <Inline width="w-24">{edit({ name: "finish", label: "finish", className: mono,
                                   placeholder: values.current ? "now" : "2025-03" })}</Inline>
    </>
  );
}

function Bullets({ project }: { project: Project }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const rows = project.bullets;

  const move = async (from: number, to: number) => {
    if (busy || to < 0 || to >= rows.length) return;
    setBusy(true);
    const order = rows.slice();
    order.splice(to, 0, ...order.splice(from, 1));
    for (const [place, bullet] of order.entries()) {
      if (bullet.seq === place) continue;
      const done = await answered(save("project_bullets", bullet.rowid, { seq: String(place) }));
      if ("error" in done) { say(done.error, true); break; }
    }
    setBusy(false);
    router.refresh();
  };

  const Move = ({ place, step, label }: { place: number; step: number; label: string }) => (
    <button type="button" aria-label={label} title={label}
            disabled={busy || place + step < 0 || place + step >= rows.length}
            onClick={() => move(place, place + step)}
            className="rounded-field px-1 text-soft transition-colors hover:bg-base-200
              hover:text-base-content disabled:invisible">
      {step < 0 ? "\u2191" : "\u2193"}
    </button>
  );

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <h5 className="eyebrow">Bullets</h5>
        <p className="text-xs text-soft">A tailored resume draws on these sentences and no others.</p>
      </div>

      {rows.length === 0 && (
        <p className="py-2 text-sm text-soft">
          Nothing here yet. Until this project has a bullet, no resume can use it.
        </p>
      )}

      <ol>
        {rows.map((bullet: Bullet, place: number) => {
          const line = editing("project_bullets", bullet.rowid,
                               bullet as unknown as Record<string, unknown>);
          return (
            <li key={bullet.rowid}
                className="group/row flex items-start gap-2 border-b border-base-200 py-1">
              <span className="tnum w-6 shrink-0 pt-1.5 text-right font-mono text-xs text-soft">
                {place + 1}
              </span>
              <div className="min-w-0 flex-1">
                {line({ name: "text", label: "bullet", kind: "area", required: true, rows: 1,
                        placeholder: "What you did, and what came of it" })}
              </div>
              <span className="flex shrink-0 items-center pt-1 opacity-0 transition-opacity
                group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                <Move place={place} step={-1} label="Move this bullet up" />
                <Move place={place} step={1} label="Move this bullet down" />
                <DeleteButton table="project_bullets" rowid={bullet.rowid} what="this bullet" />
              </span>
            </li>
          );
        })}
      </ol>

      <Adder table="project_bullets" columns={[COLUMNS.bullets[0]]}
             seed={{ project_id: String(project.rowid) }} label="Add bullet" />
    </section>
  );
}

function ProjectPanel({ project }: { project: Project }) {
  const seed = { project_id: String(project.rowid) };
  const edit = editing("projects", project.rowid, project as unknown as Record<string, unknown>);
  const start = when(project.start);
  const finish = when(project.finish);
  const dates = spanLabel(start, finish, false);

  return (
    <details className="group border-b border-base-200 last:border-0">
      <summary className="-mx-2 flex cursor-pointer list-none items-baseline gap-3 rounded-field
        px-2 py-2.5 transition-colors hover:bg-base-200 [&::-webkit-details-marker]:hidden">
        <span aria-hidden
              className="shrink-0 text-soft transition-transform group-open:rotate-90">›</span>
        <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
        {dates && <span className="tnum hidden font-mono text-xs text-soft sm:block">{dates}</span>}
        <BulletMark count={project.bullets.length} />
      </summary>

      <div className="space-y-7 pb-7 pl-5 pr-1 pt-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <label className="block">
            <span className="eyebrow block">Project</span>
            <Inline width="w-56">{edit({ name: "name", required: true,
                                         className: "font-medium" })}</Inline>
          </label>
          <label className="block">
            <span className="eyebrow block">Status</span>
            <Inline width="w-36">{edit({ name: "status", vocabulary: "status" })}</Inline>
          </label>
          <div>
            <span className="eyebrow block">Ran</span>
            <Dates table="projects" rowid={project.rowid}
                   values={project as unknown as Record<string, unknown>} />
          </div>
        </div>

        <div>
          <h5 className="eyebrow mb-1">What it was</h5>
          {edit({ name: "summary", kind: "area", label: "what it was",
                  placeholder: "One sentence on what this project was." })}
        </div>

        <Bullets project={project} />
        <section>
          <h5 className="eyebrow mb-2">Technologies</h5>
          <Chips table="project_technologies" column="technology" rows={project.technologies}
                 seed={seed} placeholder="add one, then enter" />
          <p className="mt-1.5 text-xs text-soft">
            What a job description is matched against.
          </p>
        </section>

        <div className="grid gap-7 md:grid-cols-2">
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
        </div>

        <section>
          <h5 className="eyebrow mb-2">Notes to yourself</h5>
          <div className="space-y-1">
            {edit({ name: "shared_with", label: "shared with",
                    placeholder: "Who else worked on it" })}
            {edit({ name: "notes", kind: "area",
                    placeholder: "Anything worth remembering when this comes up in an interview" })}
          </div>
        </section>

        <div className="flex items-center gap-2 border-t border-base-200 pt-4 text-xs text-soft">
          <DeleteButton table="projects" rowid={project.rowid} what={project.name} />
          Delete this project and everything under it.
        </div>
      </div>
    </details>
  );
}

function EmployerBlock({ employer, gap }: { employer: Employer; gap: string | null }) {
  const held = employer as unknown as Record<string, unknown>;
  const edit = editing("employers", employer.rowid, held);
  const start = when(employer.start);
  const finish = when(employer.finish);
  const current = employer.current === 1;
  const length = start ? lengthLabel(monthsBetween(start, current ? today() : finish ?? start)) : null;
  const bullets = employer.projects.reduce((sum, project) => sum + project.bullets.length, 0);

  return (
    <>
      <div className="md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-x-6">
        <p className="eyebrow tnum mb-1 md:mb-0 md:pt-2 md:text-right">
          {start ? whenLabel(start).replace(" ", " ") : "undated"}
        </p>

        <div className="spine relative pb-10 pl-5">
          <span aria-hidden className={`absolute -left-[3.5px] top-2.5 size-[7px] rounded-full
            ${current ? "bg-signal" : "bg-base-content"}`} />

          <div className="flex flex-wrap items-baseline gap-x-3">
            <Inline width="w-full max-w-md">
              {edit({ name: "name", label: "employer", required: true,
                      className: "font-display text-lg font-semibold tracking-tight" })}
            </Inline>
          </div>
          <Inline width="w-full max-w-md">
            {edit({ name: "title", label: "your title", placeholder: "Your title there",
                    className: "text-sm" })}
          </Inline>

          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <Dates table="employers" rowid={employer.rowid} values={held} />
            <Inline width="w-28">
              {edit({ name: "current", label: "still there",
                      options: [["1", "still there"], ["0", "left"]], required: true,
                      className: "text-xs" })}
            </Inline>
            {length && <span className="text-xs text-soft">{length}</span>}
          </div>

          <div className="mt-3 max-w-2xl">
            {edit({ name: "context", kind: "area", label: "what the company does",
                    placeholder: "What does this company do? One or two lines is plenty." })}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h4 className="eyebrow">Projects</h4>
              <p className="tnum text-xs text-soft">
                {employer.projects.length} project{employer.projects.length === 1 ? "" : "s"}
                {" · "}{bullets} bullet{bullets === 1 ? "" : "s"}
              </p>
            </div>

            {employer.projects.length === 0 && (
              <p className="py-2 text-sm text-soft">
                No projects here yet. A project is the unit a resume is built from — one piece of
                work, with the bullets that describe it.
              </p>
            )}

            <div className="mt-1 border-t border-base-200">
              {employer.projects.map((project) => (
                <ProjectPanel key={project.rowid} project={project} />
              ))}
            </div>

            <Adder table="projects" columns={COLUMNS.projects}
                   seed={{ employer_id: String(employer.rowid) }} label="Add project" />
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-soft">
            <DeleteButton table="employers" rowid={employer.rowid} what={employer.name} />
            Delete this employer, its projects and their bullets.
          </div>
        </div>
      </div>

      {gap && (
        <div className="md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-x-6">
          <span />
          <p className="spine-gap py-3 pl-5 text-xs text-soft">{gap} with no role recorded</p>
        </div>
      )}
    </>
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

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-base-300
        pb-5">
        <p className="text-sm">
          {experience.years === null ? (
            <span className="text-soft">
              No dates on file yet, so a form asking for years of experience has nothing to answer
              with.
            </span>
          ) : (
            <>
              <span className="tnum font-medium">{experience.years} years</span>
              <span className="text-soft">
                {" "}of experience, {experience.relevant_years} of them relevant, counted from{" "}
                {experience.clock_starts}. Correct a date below; there is no total to edit.
              </span>
            </>
          )}
        </p>
        <p className="tnum ml-auto text-xs text-soft">
          {employers.length} employers · {projects} projects · {bullets} bullets
          {thin > 0 && (
            <span className="text-signal">
              {" · "}{thin} project{thin === 1 ? "" : "s"} with no bullet
            </span>
          )}
        </p>
      </div>

      {ordered.map((employer) => {
        const start = opened(employer);
        const covered = start ? covering(ordered, start) : null;
        const idle = start && covered ? monthsBetween(covered, start) : 0;
        return (
          <EmployerBlock key={employer.rowid} employer={employer}
                         gap={idle >= GAP_MONTHS ? lengthLabel(idle) : null} />
        );
      })}

      <div className="md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-x-6">
        <span />
        <div className="pl-5">
          <Adder table="employers" columns={COLUMNS.employers} label="Add an employer"
                 hint="Where you worked, what you were called, and when" />
        </div>
      </div>
    </div>
  );
}
