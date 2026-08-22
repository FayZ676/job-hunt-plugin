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
