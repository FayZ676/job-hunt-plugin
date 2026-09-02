# Storage

One convention: `$CAREER/job.db` — postings, prospects, filters, staged applications, history, and
the user's whole profile are rows in it. The filesystem holds only built PDFs: `$CAREER/resumes/`,
moved to `submitted/` when an application goes out.

**`$CAREER` is a fixed absolute directory, so `/job` runs identically from anywhere.** Ask the skill
where it is rather than resolving against the working directory:

```bash
CAREER=$(job-paths career)
```

`job-paths` also answers `db`, `resumes` and `submitted`. Default `~/data/job`; `JOB_CAREER_DIR`
overrides it. **Paths stored in the database are absolute** — a relative one breaks the next run
started somewhere else.

## One table, three writers

`postings` holds every job ever fetched. The fetch owns the columns the source filled, the search
owns `disposition`, and the later phases own `status` and what follows it — disjoint columns on one
row, so the raw record and the role being pursued cannot drift. `disposition` names the filter that
ruled on each row, so "what did that filter cost me" is a query, and a changed filter re-rules what
is stored instead of going back to the network. `prospects` is the view over the rows the search kept
(`disposition='kept'`); it is what the later phases read.

```bash
job-q --schema   # the manual: tables, views, CHECKs, triggers
job-q "SELECT * FROM triage WHERE status='new'"
job-q --json "SELECT * FROM staged"
```

`$Q` stands for `job-q` throughout this skill and its references.

**Read `--schema` before writing SQL** — it documents every table, and its `CHECK`s make an invalid
row impossible to write. Two things it does not say:

- **Insert into `events` only to add a `note`** the status change alone does not carry; the triggers
  write the rest.
- **`triage` omits `description` on purpose.** Pull descriptions one at a time, for survivors only:
  `SELECT * FROM prospects` is almost always a mistake, and `SELECT * FROM postings` more so.

## The profile

**Every column says what it holds**, and `$Q --schema` is where it says it. **The profile answers out
of one single-row table** — `identity`, one column per question a form can ask, so
`<section>.<name>` is a table and a column. `experience` answers the same way but is a view:
the totals count themselves off `employers`, so a stored number cannot go stale or disagree with the
resume. The dashboard's controls and the CLI's errors are both read off `lib/core/schema.ts`, so
there is one copy and not two: a column added there arrives in both on the next connect, and the
Profile page groups it by where it was declared.

**Point the user at the dashboard rather than reading rows aloud.** `/job ui` serves
`127.0.0.1:8765` — every job opening on its full application with each drafted essay and flagged
field, and the whole profile with its `NULL`s called out. **The Profile page writes.** Every box on it
saves the moment it loses focus, and emptying one sets `NULL` — the user correcting their own answers
is the one thing they should never need you for. Everything a phase decides — postings, scores,
staged forms — is read-only there, because the invariants that make a write safe live here, not in
a web page.

**So read the profile before you write it, always.** The user may have edited it in the page since you
last looked, and a stale read overwrites their correction.

**The user never opens a file and never writes SQL.** Their career history, a corrected fact, a
changed goal: they talk, you write rows. Read before writing — you are merging, not replacing — and
ask about anything genuinely ambiguous: dates, whether work was solo, whether a number was measured
or estimated, since an invented number here becomes a lie on a resume. **Never invent experience**; a
project belongs in `projects` only if the user said it happened. **A correction lands on the row it
corrects** — a wrong number in `project_metrics`, a wrong title on `employers`, everything else in
that project's `notes` — so there is one place to read and nothing to reconcile. A row that does not
exist means "none", not "never asked". `$Q --export` hands them the whole thing as portable SQL.

**Never write run notes or daily summaries to disk.** The database is the record, and a question
about the search — what went quiet, which companies reject fastest — is **answered with a query**, in
the conversation.
