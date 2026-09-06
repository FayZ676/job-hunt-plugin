# The app

Read before changing the code. Nothing here is needed to run an action.

```bash
npm install --prefix "$HOME/.claude/skills/job"   # dependencies
npm link --prefix "$HOME/.claude/skills/job"      # the job-* commands, on PATH
```

That puts every action on `PATH` as `job-search`, `job-score`, `job-resume`, `job-stage`,
`job-submit`, `job-cleanup`, `job-q`, `job-profile`, `job-paths` and `job-help` — the names used throughout this
skill. The same install serves `/job ui`. Node 22.18 or newer runs the TypeScript directly, so there is nothing
to build.

## Modules

**One module per action, under `cli/`.**

**One app, one language.** `lib/core/` is what everything shares — `schema.ts` (the typed mirror of
the SQL, and what a column takes), `actions.ts` (the roster), `db.ts` (paths and connect), `text.ts`,
`table.ts`, `posting.ts`, `sources.ts`, `typst.ts`, `ddl.ts`. Beside it sits one file per action that has logic of its own:
**`lib/x.ts` decides and returns a value, `cli/x.ts` parses argv and prints it**, so a page and a
command can call the one function. `lib/web/` is the dashboard's own half. `sql/logic.sql` sits under
none of them, applied on every connect from a page or an action, so neither side owns it.

**The pages under `app/` are the only thing that writes the profile.** A page reads the rows it
renders through `lib/web/queries.ts`, and a server action in `lib/web/edit.ts` writes the one
column it was given. Everything under `components/edit/` writes and everything beside it only
displays, so what can reach the database is the part of the tree you can point at.

## Adding or changing an action

**`lib/core/actions.ts` is the only place an action is declared.** Its `does` and `argument` render
`job-help`, its order is the order the console lists, and its `accepts` is the statuses a posting
must be in for that action to be offered or allowed — so `requires()` in `lib/stage.ts` and
`lib/submit.ts` and the buttons on a posting page cannot drift apart. A status outside the enum in
`schema.ts` will not typecheck.

## Adding an ATS

**Every fetcher is one file in `lib/core/fetch/ats`, and nothing outside that directory names an
ATS.** The directory is read at run time, so a file dropped in is crawled on the next search and a
file deleted is simply gone — `lib/core/fetch/contract.ts` refuses one that does not satisfy the
contract, and `job-companies fetchers` prints what is plugged in.

A fetcher exports one default object: `candidate` turns whatever the user typed into a board
identifier or `null`, `probe` says whether that board is real and what the employer calls itself,
and `openings` returns `Posting[]`. Build every row through `posting()` — the shared rules, the
scoring and the dashboard all read those columns and none of them know which ATS filled them. The
`Aim` it is handed is a hint, not a contract: push whatever of it the ATS can filter server-side and
ignore the rest, because the crawl applies all of it again to whatever comes back.

Two things a new fetcher has to get right, because nothing downstream can:

- **`key` must be `<id>:<something stable across runs>`**, or the same job is new every day. Prefer
  the ATS's own posting id; where it is only unique within a board, prefix the board.
- **A board that answers with nothing must fail, not return `[]`.** `net.ts` maps 404 and 410 to
  `Missing`, retries 429 and 5xx, and lets everything else through as an error the crawl reports by
  name. Swallowing an error hides a dead board behind a quiet search.

Registering an employer costs one request per fetcher, so `candidate` returning `null` for input
that is obviously not yours is worth the line — Workday needs a full URL and says so rather than
probing every bare word.

## Changing the schema

**`lib/core/schema.ts` is the only place a column is declared.** `lib/core/ddl.ts` renders the DDL
from it on every connect — the type, nullability, every `CHECK`, the indexes, and the views whose
body is just a column list. There is no generated file to keep in step and nothing to run after an
edit. Triggers and the views with real SQL in them live in `sql/logic.sql`, which is hand-written and
concatenated onto the rendered DDL. `job-q --schema` prints both.

A column is a Zod field plus `.meta()`: `sql` is the DDL after the type (`CHECK`, `DEFAULT`,
`REFERENCES`), and `takes` is the English a wrong answer is refused with. An enum field generates
its own `CHECK (x IN (…))`, and `ui` carries what only a form needs — input type, placeholder, an
HTML pattern — so a column is declared once and reaches the DDL, the dashboard's controls and the
CLI's errors from there.

**Applied is not migrated.** `CREATE TABLE IF NOT EXISTS` does nothing to a table that already
exists, so a new column leaves every database that has already been opened exactly as it was, and
`align` then refuses to open it. So a column change is: edit `lib/core/schema.ts`, then
`ALTER TABLE` against the live database. That last one goes through `sqlite3 "$(job-paths db)"`,
never `job-q` — the check runs before the SQL does, so `job-q` refuses to open the database that
needs fixing.

Dropping a column or a table drops what it holds, and no later run can bring it back. **Save the rows
first, and tell the user what you saved and where** — the judgment about whether they are worth
keeping is theirs, not yours.
