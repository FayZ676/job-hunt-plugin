# The app

Read before changing the code. Nothing here is needed to run a phase.

```bash
npm install --prefix "$HOME/.claude/skills/job"   # dependencies
npm link --prefix "$HOME/.claude/skills/job"      # the job-* commands, on PATH
```

That puts every phase on `PATH` as `job-search`, `job-score`, `job-resume`, `job-stage`,
`job-submit`, `job-q`, `job-profile` and `job-paths` — the names used throughout this skill. Every
one of them takes `--help`. The same install serves `/job ui`. Node 22.18 or newer runs the
TypeScript directly, so there is nothing to build.

## Modules

**One module per phase, under `cli/`.** Each runs on its own, so any step can be redone without the
ones before it.

| Phase                 | Module          | Subcommands                                    |
| --------------------- | --------------- | ---------------------------------------------- |
| 1 — Search            | `cli/search.ts` | (default) `rule` `dispositions`                |
| 2 — Score             | `cli/score.ts`  | `triage` `instructions` `show` `set` `pending` |
| 3 — Resume            | `cli/resume.ts` | `spec` `build`                                 |
| 4 — Stage             | `cli/stage.ts`  | `add` `show` `list` `drop`                     |
| 5 — Review and submit | `cli/submit.ts` | `review` `record` `rejected`                   |

**One app, one language.** `lib/core/` is what everything shares — `schema.ts` (the typed mirror of
the SQL, and what a column takes), `db.ts` (paths and connect), `text.ts`, `table.ts`, `posting.ts`,
`sources.ts`, `typst.ts`. Beside it sits one file per phase that has logic of its own: **`lib/x.ts`
decides and returns a value, `cli/x.ts` parses argv and prints it**, so a page and a command can call
the one function. `lib/web/` is the dashboard's own half. `sql/` sits under none of them: `job.sql`
and `profile.sql` are applied on every connect, from a page or a phase, so neither side owns the file
that defines both.

**The pages under `app/` are the only thing that writes the profile.** A page reads the rows it
renders through `lib/web/queries.ts`, and a server action in `lib/web/actions.ts` writes the one
column it was given. Everything under `components/edit/` writes and everything beside it only
displays, so what can reach the database is the part of the tree you can point at.

## Changing the schema

**`sql/*.sql` is the only place a column is declared.** `lib/core/tables.generated.ts` is written
by `npm run schema`, which reads the DDL — every column, its nullability, and any `CHECK (x IN (…))`
as a real enum. Never edit it by hand; the next regenerate discards the edit.

**Applied is not migrated.** `CREATE TABLE IF NOT EXISTS` does nothing to a table that already
exists, so editing `sql/*.sql` leaves every database that has already been opened exactly as it was,
and `align` then refuses to open it. So a column change is: edit the DDL, `npm run schema`, and
`ALTER TABLE` against the live database. That last one goes through `sqlite3 "$(job-paths db)"`,
never `job-q` — the check runs before the SQL does, so `job-q` refuses to open the database that
needs fixing.

Dropping a column or a table drops what it holds, and no later run can bring it back. **Save the rows
first, and tell the user what you saved and where** — the judgment about whether they are worth
keeping is theirs, not yours.
