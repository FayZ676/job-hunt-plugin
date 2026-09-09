-- Behavior the schema cannot declare: the triggers that stamp a posting once it
-- is kept and couple score to status, and the views whose bodies are not a
-- column list.
-- Tables, indexes and the views derived from them are rendered from lib/core/ddl.ts.

DROP TRIGGER IF EXISTS on_kept;

CREATE TRIGGER IF NOT EXISTS on_kept AFTER UPDATE OF disposition ON postings
WHEN new.disposition = 'kept' AND old.disposition IS NOT 'kept'
BEGIN
  UPDATE postings SET status = COALESCE(status, 'new'),
                      first_seen = COALESCE(first_seen, date('now')),
                      last_seen = date('now')
  WHERE key = new.key;
END;

DROP TRIGGER IF EXISTS on_kept_insert;

CREATE TRIGGER IF NOT EXISTS on_kept_insert AFTER INSERT ON postings
WHEN new.disposition = 'kept'
BEGIN
  UPDATE postings SET status = COALESCE(status, 'new'),
                      first_seen = COALESCE(first_seen, date('now')),
                      last_seen = date('now')
  WHERE key = new.key;
END;

DROP TRIGGER IF EXISTS on_status_change;

DROP TABLE IF EXISTS events;

-- Scoring sets the status by the threshold in settings, so a score and a
-- shortlist decision can never disagree.
DROP TRIGGER IF EXISTS on_score;

CREATE TRIGGER IF NOT EXISTS on_score AFTER UPDATE OF score ON postings
WHEN new.disposition = 'kept' AND new.score IS NOT NULL AND new.score IS NOT old.score
BEGIN
  UPDATE postings SET status = CASE
    WHEN new.score >= COALESCE((SELECT CAST(value AS INTEGER) FROM settings
                                WHERE key='shortlist_threshold'), 7)
    THEN 'shortlisted' ELSE 'skipped' END
  WHERE key = new.key;
END;

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
           MAX(finish IS NULL) AS ongoing,
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

-- The whole career file, flattened for resume selection.
CREATE VIEW IF NOT EXISTS career AS
  SELECT e.name AS employer, e.title AS role, e.start AS employer_start,
         e.finish AS employer_end, p.id AS project_id, p.name AS project,
         p.about
  FROM employers e JOIN projects p ON p.employer_id = e.id
  ORDER BY e.seq, p.seq;
