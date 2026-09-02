-- Behavior the schema cannot declare: the triggers that keep history and couple
-- score to status, and the views whose bodies are not a column list.
-- Tables, indexes and the views derived from them are rendered from lib/core/ddl.ts.

CREATE TRIGGER IF NOT EXISTS on_kept AFTER UPDATE OF disposition ON postings
WHEN new.disposition = 'kept' AND old.disposition IS NOT 'kept'
BEGIN
  UPDATE postings SET status = COALESCE(status, 'new'),
                      first_seen = COALESCE(first_seen, date('now')),
                      last_seen = date('now')
  WHERE key = new.key;
  INSERT INTO events(key,status,note)
    SELECT new.key, COALESCE(new.status, 'new'), 'first seen'
    WHERE new.first_seen IS NULL;
END;

DROP TRIGGER IF EXISTS on_kept_insert;

CREATE TRIGGER IF NOT EXISTS on_kept_insert AFTER INSERT ON postings
WHEN new.disposition = 'kept'
BEGIN
  UPDATE postings SET status = COALESCE(status, 'new'),
                      first_seen = COALESCE(first_seen, date('now')),
                      last_seen = date('now')
  WHERE key = new.key;
  INSERT INTO events(key,status,note)
    SELECT new.key, COALESCE(new.status, 'new'), 'first seen'
    WHERE new.first_seen IS NULL;
END;

DROP TRIGGER IF EXISTS on_status_change;

CREATE TRIGGER IF NOT EXISTS on_status_change AFTER UPDATE OF status ON postings
WHEN new.status IS NOT old.status AND new.status IS NOT NULL
     AND old.status IS NOT NULL
BEGIN
  INSERT INTO events(key,status) VALUES(new.key, new.status);
END;

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

DROP VIEW IF EXISTS stats;

CREATE VIEW stats AS
  SELECT status, COUNT(*) AS n FROM postings
  WHERE disposition = 'kept' GROUP BY status ORDER BY n DESC;

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

-- The whole career file, flattened for resume selection.
CREATE VIEW IF NOT EXISTS career AS
  SELECT e.name AS employer, e.title AS role, e.start AS employer_start,
         e.finish AS employer_end, p.id AS project_id, p.name AS project,
         p.status, p.summary, p.shared_with, p.notes
  FROM employers e JOIN projects p ON p.employer_id = e.id
  ORDER BY e.seq, p.seq;
