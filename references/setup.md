# First-run setup

Run when `$CAREER` is missing, or when the user asks for setup.

**1. Create the database.**

```bash
CAREER=$(job-paths career)
mkdir -p "$CAREER/resumes/submitted"
job-q "SELECT 1"
```

The schema applies on connect, so any command creates `$CAREER/job.db`. It starts empty — there is
no seed. The filters come out of the interview below, in their words, not from a
starter list they would have to discover and correct.

**2. Fill the profile by interviewing them.** Every field a form can ask for is already a column,
NULL until answered: the profile is three single-row tables in `sql/profile.sql`, one per section,
and the columns are the schema — not something an interview or the dashboard adds to. They talk;
you answer with `job-profile set <section>.<name> <value>`, which names the table and the column —
one answer per call. If a form genuinely asks something no column covers, `ALTER TABLE` it into `sql/profile.sql` and add
it to `lib/core/schema.ts`; it then appears in the dashboard on the next connect.

**Translate the answer into the column's shape**, rather than filing the sentence they said: "two
weeks after an offer" is `identity.notice_period 2_weeks`. There is no start-date column — notice
and whether an employer is still `current` are what a start date gets computed from.
A column given a new shape or a new choice updates both the CLI and the dashboard.

Never hand them a file to edit, and never make the first pass a form — the interview is a
conversation. Afterwards they revise themselves in the dashboard, whose Profile page writes every
one of these tables, so tell them where it is once the profile stands up. `$Q --schema` documents
every table. Cover:

- **Identity** (`identity.*`) — contact details, work authorization, when they could start, and
  the EEO questions forms ask last, and the compensation floor. The
  EEO answers are optional, and `decline_to_say` is a complete answer — offer it rather than
  pressing.
- **What to do with all that.** One piece of prose in `instructions.text`, written in their words
  and read over the profile rather than repeating it. Nothing forces a question here, so **ask all
  of it**: the work they want, strongest first, in the words a job board would use for it — the
  paid search is typed off this prose, so it has to name the roles plainly enough to search on —
  seniority, the years a posting may ask for before it stops fitting, what makes an opening better,
  what puts them off, and what makes them skip it outright — and **how those relate**, which is the
  judgement a list cannot hold. Keep the slopes they describe: "7+ years only when the rest is a
  bullseye" is the answer, not a number. **Name the hard stops as hard stops** in the prose, or they
  read as a strong dislike. **A rule a pattern could decide is a `filters` row** — a country, a
  title they never take, an agency name. **A fact `identity` already holds does not belong here** —
  where they live, remote preference, relocation, employment type, the floor.
  `job-score instructions` prints those above the prose, so restating them only gives the two a
  chance to disagree.
- **Their experience.** The longest part and the one that matters most: `employers` → `projects` is
  **the only source a resume may draw from**, so a thin profile produces thin resumes. Offer to read
  a resume, CV, or LinkedIn export and draft it for them to correct.

A `NULL` is not a failure — it is a hard stop later. Tell them which ones will block an application.

**3. Write the filters.** `filters` is what the search rules on, and `title_exclude`, `title_noise` and
`agency_blocklist` are also pushed into the paid search, so a filter written here is credit not
spent. Derive them from what they just told you — the field they work in, the titles they refuse,
the countries they cannot work in:

```sql
INSERT INTO filters(kind,pattern) VALUES('title_include','(?i)\b(ai|ml|llm|nlp|rag)\b');
INSERT INTO filters(kind,pattern) VALUES('title_exclude','(?i)\b(intern|manager|director)\b');
INSERT INTO filters(kind,pattern) VALUES('location_include','(?i)remote|united states');
```

**Keep `title_exclude` and `title_noise` as flat `\b(a|b|c)\b` alternations.** Those flatten into
literal terms the search can exclude before charging for them; a character class or a quantifier
cannot, and quietly falls back to being paid for.

**4. Check the tooling.** The npm dependencies and the linked `job-*` commands are what fetching
and scoring run on; Typst and Poppler are only for the resume build.

```bash
command -v job-search || echo 'npm install --prefix "$HOME/.claude/skills/job" && npm link --prefix "$HOME/.claude/skills/job"'
command -v typst    || echo "brew install typst"
command -v pdftoppm || echo "brew install poppler"
[ -s "$HOME/.claude/skills/job/.env.local" ] || echo "APIFY_TOKEN=… needed in the skill's .env.local"
```

**The Apify token is required, not optional** — it is the only way postings arrive. It goes in
`.env.local` in the skill directory, which is git-ignored and read by both the commands and the
dashboard.

**5. Do a dry run.** `job-search "<a role they named>" --max 25`, then query `triage`. Keep the
first run small: it is billed per job returned, and the point is to see whether the filters aim
straight, not to fill the database. Sensible companies means they are tuned; nothing, or all noise,
means another pass — the drop counts say which rule, and `job-search rule --redo` re-rules the same
postings after each adjustment **without spending again**.
