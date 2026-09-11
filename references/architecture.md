# The app

Read before changing the code. Nothing here is needed to run an action.

```bash
npm install --prefix "$HOME/.claude/skills/job"   # dependencies
npm link --prefix "$HOME/.claude/skills/job"      # the job-* commands, on PATH
```

That puts every action on `PATH` as `job-search`, `job-score`, `job-resume`, `job-stage`,
`job-submit`, `job-cleanup`, `job-q`, `job-profile`, `job-paths` and `job-help` — the names used throughout this
skill. Node 22.18 or newer runs the TypeScript directly, so there is nothing to build.

## Modules

**One module per action, under `cli/`.**

**One app, one language.** `lib/core/` is what everything shares — the schema, the action roster,
paths and connect, and everything Indeed, the browser and the resume build need beneath one action.
Beside it sits one file per action that has logic of its own: **`lib/x.ts` decides and returns a
value, `cli/x.ts` parses argv and prints it**. `sql/logic.sql` is applied on every connect.

**`exports` in `package.json` is the library's public surface.** Renaming or reshaping anything a
listed module exports breaks whatever imports this package, so say so before doing it.

## Adding or changing an action

**`lib/core/actions.ts` is the only place an action is declared.** Its `does` and `argument` render
`job-help`, and its `accepts` is the statuses a posting must be in for that action to be allowed,
which `requires()` enforces in `lib/stage.ts` and `lib/submit.ts`. A status outside the enum in
`schema.ts` will not typecheck.

## The search half

**`lib/core/indeed.ts` is the only place that knows Indeed's payload shape.** It turns saved cards
into `Posting` rows through `posting()`; the ruling and the scoring read those columns and neither
knows where a row came from. A shape change is one file.

**`lib/core/cdp.ts` drives the browser, and `lib/crawl.ts` is the run**: navigate a query, read the
cards, rule, then navigate each survivor's page for its description. It is code rather than model
turns because a run is hundreds of navigations, and through the model that is hundreds of
round-trips and a harvest's worth of context. Each description is written as it lands, so a run cut
short keeps what it fetched and running it again finishes the job. `harvest --file` stays for the
times a person has to drive the browser instead.

**`key` is `indeed:<jobkey>`**, and `jobkey` is stable across runs, which is what makes the same job
recognizable tomorrow.

## Changing the schema

**`lib/core/schema.ts` is the only place a column is declared.** `lib/core/ddl.ts` renders the DDL
from it on every connect — the type, nullability, every `CHECK`, the indexes, and the views whose
body is just a column list. There is no generated file to keep in step and nothing to run after an
edit. Triggers and the views with real SQL in them live in `sql/logic.sql`, which is hand-written and
concatenated onto the rendered DDL. `job-q --schema` prints both.

A column is a Zod field plus `.meta()`: `sql` is the DDL after the type (`CHECK`, `DEFAULT`,
`REFERENCES`), and `takes` is the English a wrong answer is refused with. An enum field generates
its own `CHECK (x IN (…))`, so a column is declared once and reaches the DDL and the CLI's errors
from there.

**Applied is not migrated.** `CREATE TABLE IF NOT EXISTS` does nothing to a table that already
exists, so a new column leaves every database that has already been opened exactly as it was, and
`align` then refuses to open it. So a column change is: edit `lib/core/schema.ts`, then
`ALTER TABLE` against the live database. That last one goes through `sqlite3 "$(job-paths db)"`,
never `job-q` — the check runs before the SQL does, so `job-q` refuses to open the database that
needs fixing.

Dropping a column or a table drops what it holds, and no later run can bring it back. **Save the rows
first, and tell the user what you saved and where** — the judgment about whether they are worth
keeping is theirs, not yours.
