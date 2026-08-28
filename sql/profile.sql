-- The user's own data, and the only thing they own. Applied on every connect
-- after job.sql; every statement is idempotent. Nothing here references a job
-- table and nothing there references these, so the two files stay independent.
-- They never write SQL for it: they talk, paste a resume, or upload a CV, and
-- the model writes these rows. A NULL value means "not answered yet" and is a
-- hard stop when a form asks for it -- absence is typed, not a TODO string.

-- Scalar answers. Key/value because that is genuinely the shape of a form.
-- 'field' is '<section>.<name>' and the section is read back out of it, so the
-- two can never disagree and nothing has to assert one.
CREATE TABLE IF NOT EXISTS profile (
  field   TEXT PRIMARY KEY,      -- 'identity.email', 'availability.notice_period'
  value   TEXT,                  -- NULL = unanswered = hard stop
  section TEXT GENERATED ALWAYS AS (substr(field, 1, instr(field, '.') - 1)) VIRTUAL
            CHECK (section IN (
            'identity', 'work_authorization', 'availability', 'compensation',
            'demographics', 'experience', 'search')),
  CHECK (instr(field, '.') < length(field))
);

CREATE TABLE IF NOT EXISTS education (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  degree      TEXT NOT NULL,
  institution TEXT,
  finished    TEXT
);

CREATE TABLE IF NOT EXISTS employers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  title   TEXT,
  start   TEXT,
  finish  TEXT,
  current INTEGER NOT NULL DEFAULT 0,
  context TEXT,
  seq     INTEGER
);

-- The only source a resume may draw from.
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start       TEXT,
  finish      TEXT,
  status      TEXT CHECK (status IN ('shipped','in_progress','discontinued')),
  summary     TEXT,
  shared_with TEXT,             -- 'one other engineer' — how shared work stays honest
  notes       TEXT,
  seq         INTEGER
);

CREATE TABLE IF NOT EXISTS project_bullets (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq        INTEGER,
  text       TEXT NOT NULL
);

-- What a JD is matched against when selecting bullets.
CREATE TABLE IF NOT EXISTS project_technologies (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  technology TEXT NOT NULL,
  PRIMARY KEY (project_id, technology)
);

CREATE TABLE IF NOT EXISTS project_metrics (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_links (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL
);

-- What is worth applying to. `kind` says how the scorer uses the row.
CREATE TABLE IF NOT EXISTS search_criteria (
  kind   TEXT NOT NULL CHECK (kind IN (
           'title_preferred','title_acceptable','title_excluded','title_penalty',
           'score_up','score_down','dealbreaker','brings','location_tier',
           'experience_floor','level')),
  value  TEXT NOT NULL,
  weight INTEGER,               -- score effect, where the row carries one
  note   TEXT,
  seq    INTEGER,
  PRIMARY KEY (kind, value)
);

-- Judgement that resists a schema. Read on every scoring pass; never compile
-- these into weights -- they are what lets the model generalise to a case
-- nobody enumerated.
CREATE TABLE IF NOT EXISTS search_notes (
  topic TEXT PRIMARY KEY,
  note  TEXT NOT NULL
);

-- Corrections that must never be reproduced on a resume.
CREATE TABLE IF NOT EXISTS facts (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  fact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_limits (
  company TEXT PRIMARY KEY,
  stated  TEXT NOT NULL
);

-- Which employer logins exist. Store where the password lives, not the password.
CREATE TABLE IF NOT EXISTS accounts (
  employer          TEXT PRIMARY KEY,
  system            TEXT,
  portal_url        TEXT,
  login_email       TEXT,
  password_location TEXT,
  created           TEXT
);

-- Everything a form could ask that has no answer yet. Phase 4 checks this
-- before staging; anything listed here blocks rather than gets guessed.
CREATE VIEW IF NOT EXISTS unanswered AS
  SELECT field, section FROM profile WHERE value IS NULL ORDER BY section, field;

-- The whole career file, flattened for resume selection.
CREATE VIEW IF NOT EXISTS experience AS
  SELECT e.name AS employer, e.title AS role, e.start AS employer_start,
         e.finish AS employer_end, p.id AS project_id, p.name AS project,
         p.status, p.summary, p.shared_with, p.notes
  FROM employers e JOIN projects p ON p.employer_id = e.id
  ORDER BY e.seq, p.seq;
