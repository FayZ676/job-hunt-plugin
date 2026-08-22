-- The job database. Applied on every connect; every statement is idempotent.
--
-- Constraints and triggers carry the rules that used to live in Python:
-- CHECK rejects an invalid status at the storage layer, and the triggers below
-- log history without any caller having to remember to.

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Both kinds of board. ats in (greenhouse,lever,ashby) is scanned by API;
-- ats='manual' is checked by hand on `cadence`.
CREATE TABLE IF NOT EXISTS companies (
  slug         TEXT NOT NULL,
  ats          TEXT NOT NULL,
  name         TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  added_on     TEXT DEFAULT (date('now')),
  source       TEXT,
  careers_url  TEXT,
  cadence      TEXT CHECK (cadence IS NULL OR cadence IN ('Weekly','Monthly','Quarterly')),
  last_checked TEXT,
  why          TEXT,
  PRIMARY KEY (ats, slug)
);

CREATE TABLE IF NOT EXISTS filters (
  kind    TEXT NOT NULL CHECK (kind IN (
            'title_include','title_exclude','location_include','location_exclude',
            'us_tokens','title_noise','agency_name_patterns','agency_blocklist')),
  pattern TEXT NOT NULL,
  note    TEXT,
  PRIMARY KEY (kind, pattern)
);

-- Everything a fetch returned, before any judgment. Fetching writes here and
-- nothing else; ingest reads here and derives prospects. Keeping the raw layer
-- is what makes a filter re-runnable without going back to the network, and
-- what turns "what did that filter cost me" into a query.
--
-- Sources normalize into these columns so that every filter applies to every
-- source. A source that cannot know a fact leaves the default, which reads as
-- "unremarkable" rather than "no" -- that is what keeps ingest free of any
-- condition naming a particular source.
--
-- disposition is NULL until ingest has ruled on the row: 'kept' means it was
-- promoted to prospects, anything else names the filter that dropped it.
CREATE TABLE IF NOT EXISTS postings (
  key           TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  ats           TEXT,
  company       TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  apply_url     TEXT,
  location      TEXT,
  remote        INTEGER,
  compensation  TEXT,
  posted_at     TEXT,
  description   TEXT,
  sponsored     INTEGER NOT NULL DEFAULT 0,
  expired       INTEGER NOT NULL DEFAULT 0,
  comp_min      REAL,
  comp_max      REAL,
  comp_period   TEXT,
  raw           TEXT,
  first_fetched TEXT NOT NULL DEFAULT (date('now')),
  last_fetched  TEXT NOT NULL DEFAULT (date('now')),
  ingested_on   TEXT,
  disposition   TEXT CHECK (disposition IS NULL OR disposition IN (
                  'kept','upgraded','title','location','stale','seen','duplicate',
                  'sponsored','expired','agency','noise','lowball','covered'))
);

CREATE INDEX IF NOT EXISTS idx_postings_pending ON postings(disposition, last_fetched);

CREATE TABLE IF NOT EXISTS prospects (
  key          TEXT PRIMARY KEY,
  company      TEXT NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT,
  apply_url    TEXT,
  location     TEXT,
  remote       INTEGER,
  compensation TEXT,
  posted_at    TEXT,
  first_seen   TEXT NOT NULL DEFAULT (date('now')),
  last_seen    TEXT DEFAULT (date('now')),
  source       TEXT,
  ats          TEXT,
  description  TEXT,
  score        INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 10),
  reason       TEXT,
  resume       TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                 'new','scored','shortlisted','skipped','staged',
                 'applied','interviewing','rejected','not_pursued','closed'))
);

-- Multi-location postings for one role collapse to a single prospect; the
-- sibling ids live here so they never resurface as new.
CREATE TABLE IF NOT EXISTS aliases (
  alias_key TEXT PRIMARY KEY,
  key       TEXT NOT NULL REFERENCES prospects(key) ON DELETE CASCADE
);

-- History. Written by the triggers below, never by hand.
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  key    TEXT NOT NULL REFERENCES prospects(key) ON DELETE CASCADE,
  at     TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT,
  note   TEXT
);

CREATE TABLE IF NOT EXISTS staged (
  key        TEXT PRIMARY KEY REFERENCES prospects(key) ON DELETE CASCADE,
  url        TEXT,
  ats        TEXT,
  screenshot TEXT,
  status     TEXT CHECK (status IN ('ready','blocked')),
  blocked_on TEXT
);

CREATE TABLE IF NOT EXISTS staged_fields (
  key   TEXT NOT NULL REFERENCES prospects(key) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT,
  tier  TEXT CHECK (tier IN ('identity','policy','judgment')),
  flag  TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_seen   ON prospects(first_seen);
CREATE INDEX IF NOT EXISTS idx_events_key       ON events(key);

-- ---------------------------------------------------------------------------
-- History writes itself.
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS on_prospect_new AFTER INSERT ON prospects
BEGIN
  INSERT INTO events(key,status,note) VALUES(new.key, new.status, 'first seen');
END;

CREATE TRIGGER IF NOT EXISTS on_status_change AFTER UPDATE OF status ON prospects
WHEN new.status IS NOT old.status
BEGIN
  INSERT INTO events(key,status) VALUES(new.key, new.status);
END;

-- Scoring sets the status by the threshold in settings, so a score and a
-- shortlist decision can never disagree.
CREATE TRIGGER IF NOT EXISTS on_score AFTER UPDATE OF score ON prospects
WHEN new.score IS NOT NULL AND new.score IS NOT old.score
BEGIN
  UPDATE prospects SET status = CASE
    WHEN new.score >= COALESCE((SELECT CAST(value AS INTEGER) FROM settings
                                WHERE key='shortlist_threshold'), 7)
    THEN 'shortlisted' ELSE 'skipped' END
  WHERE key = new.key;
END;

-- ---------------------------------------------------------------------------
-- Views. `triage` is the one the model reads every run: it cannot leak a
-- description, because the column is not in it.
-- ---------------------------------------------------------------------------

CREATE VIEW IF NOT EXISTS triage AS
  SELECT key, company, title, location, remote, compensation, posted_at,
         first_seen, source, score, status, resume, url
  FROM prospects
  ORDER BY COALESCE(score,-1) DESC, first_seen DESC;

CREATE VIEW IF NOT EXISTS stats AS
  SELECT status, COUNT(*) AS n FROM prospects GROUP BY status ORDER BY n DESC;

CREATE VIEW IF NOT EXISTS manual_boards AS
  SELECT name, slug, cadence, last_checked, careers_url, why
  FROM companies WHERE active=1 AND ats='manual'
  ORDER BY CASE cadence WHEN 'Weekly' THEN 1 WHEN 'Monthly' THEN 2 ELSE 3 END, name;

CREATE VIEW IF NOT EXISTS needs_review AS
  SELECT p.key, p.company, p.title, p.score, s.status AS staged_status,
         s.blocked_on, f.label, f.value, f.flag
  FROM staged s
  JOIN prospects p ON p.key = s.key
  LEFT JOIN staged_fields f ON f.key = s.key AND f.flag IS NOT NULL
  WHERE p.status = 'staged';

-- ---------------------------------------------------------------------------
-- The profile. The user's own data, and the only thing they own.
--
-- They never write SQL for it: they talk, paste a resume, or upload a CV, and
-- the model writes these rows. A NULL value means "not answered yet" and is a
-- hard stop when a form asks for it -- absence is typed, not a TODO string.
-- ---------------------------------------------------------------------------

-- Scalar answers: identity, work authorization, availability, compensation,
-- demographics. Key/value because that is genuinely the shape of a form.
CREATE TABLE IF NOT EXISTS profile (
  field   TEXT PRIMARY KEY,      -- 'identity.email', 'availability.notice_period'
  value   TEXT,                  -- NULL = unanswered = hard stop
  section TEXT NOT NULL,
  notes   TEXT
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
