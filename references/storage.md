# Storage

One convention: `$CAREER/job.db` — postings, prospects, staged applications, and the user's whole
profile are rows in it. The filesystem holds only built PDFs: `$CAREER/resumes/`,
moved to `submitted/` when an application goes out.

**`$CAREER` is a fixed absolute directory, so `/job` runs identically from anywhere.** Ask the skill
where it is rather than resolving against the working directory:

```bash
CAREER=$(job-paths career)
```

Default `~/data/job`; `JOB_CAREER_DIR` overrides it. **Paths stored in the database are absolute** —
a relative one breaks the next run started somewhere else.

## One table, three writers

`postings` holds every job ever fetched. The fetch owns the columns the source filled, the search
owns `disposition`, and the later actions own `status` and what follows it — disjoint columns on one
row, so the raw record and the role being pursued cannot drift. `disposition` names the rule that
ruled on each row, so "what did that rule cost me" is a query, and `job-search rule --redo` re-rules
what is stored instead of going back to the network. `prospects` is the view over the rows the search kept
(`disposition='kept'`); it is what the later actions read.

```bash
job-q --schema   # the manual: tables, views, CHECKs, triggers
job-q "SELECT * FROM triage WHERE status='new'"
job-q --json "SELECT * FROM staged"
```

`$Q` stands for `job-q` throughout this skill and its references.

**Read `--schema` before writing SQL** — it documents every table, and its `CHECK`s make an invalid
row impossible to write. One thing it does not say: **`triage` omits `description` on purpose.**
Pull descriptions one at a time, for survivors only: `SELECT * FROM prospects` is almost always a
mistake, and `SELECT * FROM postings` more so.

## The profile

**Every column says what it holds, and the profile answers out of one single-row table** —
`identity`, one column per question a form can ask, so `<section>.<name>` is a table and a column.
`experience` answers the same way but is a view: the totals count themselves off `employers`, so a
stored number cannot go stale or disagree with the resume.

**The user never opens a file and never writes SQL.** Their career history, a corrected fact, a
changed goal: they talk, you write rows. Read before writing — you are merging, not replacing — and
ask about anything genuinely ambiguous: dates, whether work was solo, whether a number was measured
or estimated, since an invented number here becomes a lie on a resume. **Never invent experience**; a
project belongs in `projects` only if the user said it happened. **A correction lands on the row it
corrects** — a wrong number or anything else about a project in its `about`, a wrong title on
`employers` — so there is one place to read and nothing to reconcile. A row that does not
exist means "none", not "never asked". `$Q --export` hands them the whole thing as portable SQL.

**Never write run notes or daily summaries to disk.** The database is the record, and a question
about the search — what went quiet, which companies reject fastest — is **answered with a query**, in
the conversation.
