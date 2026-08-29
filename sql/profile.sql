-- Who the applicant is, in the order a form asks: contact, then the yes/no
-- questions every form repeats, then when you could start, then the optional
-- ones. Declining to say is a real answer rather than a missing one, which is
-- why the last five are choices and not flags.
CREATE TABLE IF NOT EXISTS identity (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  full_name       TEXT    CHECK (trim(full_name) <> ''),
  preferred_name  TEXT    CHECK (trim(preferred_name) <> ''),
  last_name       TEXT    CHECK (trim(last_name) <> ''),
  email           TEXT    CHECK (email LIKE '_%@_%._%'),
  phone           TEXT    CHECK (NOT phone GLOB '*[A-Za-z]*' AND length(phone) >= 7),
  location        TEXT    CHECK (trim(location) <> ''),
  street_address  TEXT    CHECK (trim(street_address) <> ''),
  linkedin        TEXT    CHECK (linkedin LIKE 'http%://%.%'),
  github          TEXT    CHECK (github LIKE 'http%://%.%'),

  authorized_in_country_of_residence       INTEGER CHECK (authorized_in_country_of_residence IN (0,1)),
  legal_right_to_work_without_sponsorship  INTEGER CHECK (legal_right_to_work_without_sponsorship IN (0,1)),
  requires_sponsorship_now_or_future       INTEGER CHECK (requires_sponsorship_now_or_future IN (0,1)),
  over_18                                  INTEGER CHECK (over_18 IN (0,1)),

  earliest_start        TEXT    CHECK (earliest_start IS date(earliest_start)),
  earliest_daily_start  TEXT    CHECK (earliest_daily_start GLOB '[0-2][0-9]:[0-5][0-9]'
                                       AND earliest_daily_start <= '23:59'),
  notice_period         TEXT    CHECK (notice_period IN (
                                  'none','1_week','2_weeks','3_weeks','1_month','2_months','3_months')),
  employment_type       TEXT    CHECK (employment_type IN (
                                  'full_time','part_time','contract','internship','temporary')),
  remote_preference     TEXT    CHECK (remote_preference IN (
                                  'remote','hybrid','on_site','no_preference')),
  willing_to_relocate   INTEGER CHECK (willing_to_relocate IN (0,1)),
  compensation_floor    INTEGER CHECK (compensation_floor >= 0),
  compensation_currency TEXT    CHECK (compensation_currency GLOB '[A-Z][A-Z][A-Z]'),

  gender             TEXT CHECK (gender IN ('male','female','non_binary','decline_to_say')),
  race_ethnicity     TEXT CHECK (race_ethnicity IN (
                       'american_indian_or_alaska_native','asian','black_or_african_american',
                       'hispanic_or_latino','native_hawaiian_or_pacific_islander','white',
                       'two_or_more_races','decline_to_say')),
  hispanic_or_latino TEXT CHECK (hispanic_or_latino IN ('yes','no','decline_to_say')),
  veteran_status     TEXT CHECK (veteran_status IN (
                       'protected_veteran','not_a_protected_veteran','decline_to_say')),
  disability_status  TEXT CHECK (disability_status IN ('yes','no','decline_to_say'))
) STRICT;
INSERT OR IGNORE INTO identity(id) VALUES (1);

-- `finished` and the career dates below are as precise as the user was: a year,
-- a year and month, or a full date. A resume prints months, so demanding a day
-- would invent one.
CREATE TABLE IF NOT EXISTS education (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  degree      TEXT NOT NULL CHECK (trim(degree) <> ''),
  institution TEXT          CHECK (trim(institution) <> ''),
  finished    TEXT          CHECK (finished IS date(finished) OR date(finished || '-01') IS NOT NULL
                                   OR date(finished || '-01-01') IS NOT NULL)
) STRICT;

CREATE TABLE IF NOT EXISTS employers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL CHECK (trim(name) <> ''),
  title   TEXT          CHECK (trim(title) <> ''),
  start   TEXT          CHECK (start IS date(start) OR date(start || '-01') IS NOT NULL
                                   OR date(start || '-01-01') IS NOT NULL),
  finish  TEXT          CHECK (finish IS date(finish) OR date(finish || '-01') IS NOT NULL
                                   OR date(finish || '-01-01') IS NOT NULL),
  current INTEGER NOT NULL DEFAULT 0 CHECK (current IN (0,1)),
  context TEXT,
  seq     INTEGER       CHECK (seq >= 0),

  CHECK (current = 0 OR finish IS NULL)
) STRICT;

-- The only source a resume may draw from. A correction lives on the row it corrects --
-- a wrong number in `project_metrics`, a wrong title on `employers`, everything else
-- in `notes` -- so there is one place to read and nothing to reconcile.
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (trim(name) <> ''),
  start       TEXT          CHECK (start IS date(start) OR date(start || '-01') IS NOT NULL
                                   OR date(start || '-01-01') IS NOT NULL),
  finish      TEXT          CHECK (finish IS date(finish) OR date(finish || '-01') IS NOT NULL
                                   OR date(finish || '-01-01') IS NOT NULL),
  status      TEXT          CHECK (status IN ('shipped','in_progress','discontinued')),
  summary     TEXT,
  shared_with TEXT,             -- 'one other engineer' — how shared work stays honest
  notes       TEXT,
  seq         INTEGER       CHECK (seq >= 0)
) STRICT;

CREATE TABLE IF NOT EXISTS project_bullets (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq        INTEGER CHECK (seq >= 0),
  text       TEXT NOT NULL CHECK (trim(text) <> '')
) STRICT;

-- What a JD is matched against when selecting bullets.
CREATE TABLE IF NOT EXISTS project_technologies (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  technology TEXT NOT NULL,
  PRIMARY KEY (project_id, technology)
) STRICT;

CREATE TABLE IF NOT EXISTS project_metrics (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS project_links (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (trim(label) <> ''),
  url        TEXT NOT NULL CHECK (url LIKE 'http%://%.%')
) STRICT;

-- What is worth applying to. `kind` says how the scorer uses the row, and `seq`
-- says how much it counts: within a kind the rows run strongest first, so
-- moving a row up is the whole vocabulary for "this one matters more".
CREATE TABLE IF NOT EXISTS search_criteria (
  kind  TEXT NOT NULL CHECK (kind IN (
          'title_preferred','title_acceptable','title_excluded','title_penalty',
          'score_up','score_down','dealbreaker','brings','location_tier',
          'experience_floor','level')),
  value TEXT NOT NULL CHECK (trim(value) <> ''),
  seq   INTEGER CHECK (seq >= 0),
  PRIMARY KEY (kind, value)
) STRICT;

-- Which employer logins exist. Store where the password lives, not the password.
CREATE TABLE IF NOT EXISTS accounts (
  employer          TEXT PRIMARY KEY,
  system            TEXT,
  portal_url        TEXT CHECK (portal_url LIKE 'http%://%.%'),
  login_email       TEXT CHECK (login_email LIKE '_%@_%._%'),
  password_location TEXT,
  created           TEXT CHECK (created IS date(created))
) STRICT;

-- The totals a form asks for as a number rather than a story, counted off
-- `employers` rather than stored: a written-down total is wrong by one every
-- year and can disagree with the dates printed on the resume. The clock starts
-- at the earliest employer and runs to today while one is current, to the last
-- finish once none is. Every employer here is work worth putting on a resume,
-- so the relevant total is the same span.
DROP VIEW IF EXISTS experience;
CREATE VIEW IF NOT EXISTS experience AS
  WITH span AS (
    SELECT MIN(CASE length(start) WHEN 4 THEN start || '-01-01'
                                  WHEN 7 THEN start || '-01' ELSE start END) AS opened,
           MAX(current) AS ongoing,
           MAX(CASE length(finish) WHEN 4 THEN finish || '-12-31'
                                   WHEN 7 THEN finish || '-01' ELSE finish END) AS closed
      FROM employers
  )
  SELECT opened AS clock_starts,
         CAST((julianday(CASE WHEN ongoing THEN date('now') ELSE closed END)
               - julianday(opened)) / 365.25 AS INTEGER) AS years,
         CAST((julianday(CASE WHEN ongoing THEN date('now') ELSE closed END)
               - julianday(opened)) / 365.25 AS INTEGER) AS relevant_years
    FROM span;

-- Every question a form could ask, and whatever the profile says back. Phase 4
-- checks `unanswered` before staging; anything listed there blocks rather than
-- gets guessed. Each section hands its row to json_each, so a column added
-- above appears here without these views being touched.
DROP VIEW IF EXISTS unanswered;
DROP VIEW IF EXISTS answers;
CREATE VIEW IF NOT EXISTS answers AS
  SELECT section, answer.key AS field, answer.value AS value FROM (
    SELECT 'identity' AS section, json_object(
             'full_name', full_name, 'preferred_name', preferred_name, 'last_name', last_name,
             'email', email, 'phone', phone, 'location', location,
             'street_address', street_address, 'linkedin', linkedin, 'github', github,
             'authorized_in_country_of_residence', authorized_in_country_of_residence,
             'legal_right_to_work_without_sponsorship', legal_right_to_work_without_sponsorship,
             'requires_sponsorship_now_or_future', requires_sponsorship_now_or_future,
             'over_18', over_18,
             'earliest_start', earliest_start, 'earliest_daily_start', earliest_daily_start,
             'notice_period', notice_period, 'employment_type', employment_type,
             'remote_preference', remote_preference, 'willing_to_relocate', willing_to_relocate,
             'compensation_floor', compensation_floor,
             'compensation_currency', compensation_currency,
             'gender', gender, 'race_ethnicity', race_ethnicity,
             'hispanic_or_latino', hispanic_or_latino, 'veteran_status', veteran_status,
             'disability_status', disability_status) AS row
      FROM identity
    UNION ALL SELECT 'experience', json_object(
             'years', years, 'relevant_years', relevant_years,
             'clock_starts', clock_starts) FROM experience
  ), json_each(row) AS answer;

CREATE VIEW IF NOT EXISTS unanswered AS
  SELECT section, field FROM answers WHERE value IS NULL;

-- The whole career file, flattened for resume selection.
CREATE VIEW IF NOT EXISTS career AS
  SELECT e.name AS employer, e.title AS role, e.start AS employer_start,
         e.finish AS employer_end, p.id AS project_id, p.name AS project,
         p.status, p.summary, p.shared_with, p.notes
  FROM employers e JOIN projects p ON p.employer_id = e.id
  ORDER BY e.seq, p.seq;
