# First-run setup

Run when `$CAREER` is missing, or when the user asks for setup.

**1. Start.** If `$HOME/.claude/skills/job/node_modules` is missing, run
`npm install --prefix "$HOME/.claude/skills/job"` first — no script runs without it. Then run
`cli/setup.ts start`, and `cli/setup.ts next` at every part boundary. **Show each `say:` line
verbatim, and never announce a part, a time, or progress in your own words** — the script owns the
pacing, so the user sees one map rather than two that disagree. Run what `install:` prints without
bringing it up; where it names a package rather than a command, install that with this machine's
package manager. The database starts empty, with no seed: what the search looks for comes out of the
interview, in their words.

**2. Fill the profile by interviewing them.** Every field a form can ask for is already a column,
NULL until answered — not something an interview adds to. They talk; you answer with
`cli/profile.ts set`, one answer per call. If a form genuinely asks something no column covers, add the
field to `lib/core/schema.ts` and `ALTER TABLE` it into the live database.

**Translate the answer into the column's shape**, rather than filing the sentence they said: "two
weeks after an offer" is `identity.notice_period 2_weeks`. There is no start-date column — notice
and whether any employer has no `finish` date are what a start date gets computed from.

Never hand them a file to edit, and never make the first pass a form — the interview is a
conversation. Cover:

- **Identity** (`identity.*`) — contact details, work authorization, when they could start, and
  the EEO questions forms ask last, and the compensation floor. The
  EEO answers are optional, and `decline_to_say` is a complete answer — offer it rather than
  pressing.
- **What to do with all that.** One piece of prose in `instructions.text`, written in their words
  and read over the profile rather than repeating it. Nothing forces a question here, so **ask all
  of it**: the work they want, strongest first, in the words a job board would use for it — the
  search is typed off this prose, so it has to name the roles plainly enough to search on —
  seniority, the years a posting may ask for before it stops fitting, what makes an opening better,
  what puts them off, and what makes them skip it outright — and **how those relate**, which is the
  judgement a list cannot hold. Keep the slopes they describe: "7+ years only when the rest is a
  bullseye" is the answer, not a number. **Name the hard stops as hard stops** in the prose, or they
  read as a strong dislike. **Name the titles and the employers they never want**, plainly enough
  to type into a search box — a title they never take, a staffing firm, a former employer — because
  the search excludes them off this prose. **A fact `identity` or their work history already holds does not
  belong here** — where they live, remote preference, relocation, employment type, the floor, what
  they have built. `cli/score.ts instructions` prints those above the prose, so restating them only
  gives the two a chance to disagree.
- **Their experience.** The longest part and the one that matters most: `employers` → `projects` is
  **the only source a resume may draw from and the background every score is judged against**, so a
  thin profile produces thin resumes and scores that cannot tell a fitting posting from a stretch.
  The technologies on a project are matched against the JD, so name them even where the prose about
  the project already implies them. **Open by asking what already describes their work, before
  asking them to describe it** — a resume or CV, LinkedIn, a personal site, a blog, GitHub, or
  documents dropped into the chat. Draft from whatever they give you, then have them correct it. A
  URL you can read, read. A page behind a login, open in the browser and let them sign in and bring
  up the details. Work that lives on another machine, such as an employer laptop, reaches you
  through `cli/setup.ts prompt`: hand them its output to paste into an LLM there, and draft from
  what they paste back. What a source claims is still theirs to confirm: ask about anything it
  leaves ambiguous before it becomes a row.

A `NULL` is not a failure — it is a hard stop later. Tell them which ones will block an application.

**3. Check the prose covers the search.** There is no filter table: `instructions.text` and
`identity` are the only two places a preference can live, and every argument of the search — the
terms, `--not-title`, `--not-company` — is typed off them. Read the prose back with that call in
mind. If you cannot fill an argument from it, that is a missing sentence, not a missing feature: ask
for it, and add it to the prose in their words.

**4. Do a dry run.** Harvest one Indeed query for a role they named — `references/searching.md` has
the browser half — then query `triage`. It costs nothing, so the point is only to see whether the
prose aims straight. Sensible companies means it is tuned; nothing, or all noise, means another pass
at what the instructions say and at the queries you built from them.
