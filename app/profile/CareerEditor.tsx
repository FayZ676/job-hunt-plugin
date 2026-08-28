"use client";

import Chips from "@/components/edit/Chips";
import DeleteButton from "@/components/edit/DeleteButton";
import FieldRow from "@/components/edit/FieldRow";
import NewRow from "@/components/edit/NewRow";
import RecordList from "@/components/edit/RecordList";
import { COLUMNS } from "@/components/edit/columns";
import { Card, Label } from "@/components/ui";
import type { Employer, Project } from "@/lib/queries";

function ProjectPanel({ project }: { project: Project }) {
  const seed = { project_id: String(project.rowid) };
  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-100">
      <summary className="collapse-title flex items-center gap-2 font-medium">
        {project.name}
        <span className="ml-auto text-xs opacity-60">
          {project.bullets.length} bullet{project.bullets.length === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="collapse-content space-y-5">
        <FieldRow table="projects" rowid={project.rowid} columns={COLUMNS.projects}
                  values={project} onDelete={false} />
        <FieldRow table="projects" rowid={project.rowid} columns={COLUMNS.projectDetail}
                  values={project} stack />

        <div>
          <Label>Bullets — the only sentences a resume may draw on</Label>
          <RecordList table="project_bullets" columns={COLUMNS.bullets} rows={project.bullets}
                      seed={seed} what="this bullet"
                      empty="No bullets yet. These are what a tailored resume selects from." />
        </div>

        <div>
          <Label>Technologies — what a job description is matched against</Label>
          <Chips table="project_technologies" column="technology" rows={project.technologies}
                 seed={seed} placeholder="add one, then enter" />
        </div>

        <div>
          <Label>Metrics</Label>
          <RecordList table="project_metrics" columns={COLUMNS.metrics} rows={project.metrics}
                      seed={seed} what="this metric" />
        </div>

        <div>
          <Label>Links</Label>
          <RecordList table="project_links" columns={COLUMNS.links} rows={project.links}
                      seed={seed} what="this link" />
        </div>

        <div className="flex items-center gap-2 border-t border-base-300 pt-4 text-xs opacity-60">
          <DeleteButton table="projects" rowid={project.rowid} what={project.name} />
          Delete this project and everything under it.
        </div>
      </div>
    </details>
  );
}

function EmployerCard({ employer }: { employer: Employer }) {
  return (
    <Card className="space-y-4">
      <FieldRow table="employers" rowid={employer.rowid} columns={COLUMNS.employers}
                values={employer} what={employer.name} />
      <FieldRow table="employers" rowid={employer.rowid} columns={COLUMNS.employerContext}
                values={employer} stack />
      <div className="space-y-2">
        <Label>Projects</Label>
        {employer.projects.map((project) => <ProjectPanel key={project.rowid} project={project} />)}
        <NewRow table="projects" columns={COLUMNS.projects}
                seed={{ employer_id: String(employer.rowid) }} label="Add project" />
      </div>
    </Card>
  );
}

export default function CareerEditor({ employers }: { employers: Employer[] }) {
  return (
    <div className="space-y-4">
      {employers.map((employer) => <EmployerCard key={employer.rowid} employer={employer} />)}
      <NewRow table="employers" columns={COLUMNS.employers} label="Add employer" />
    </div>
  );
}
