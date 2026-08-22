#!/usr/bin/env python3
"""The job database: one store for every prospect, company and filter.

Replaces the per-day scan files and the append-only JSONL ledger. There is no
record of "a scan" any more -- a scan updates prospects, and questions about
what happened are queries.

  db.py init [--seed watchlist.toml]   create the schema
  db.py list [--status …] [--min-score N] [--new] [--limit N]
  db.py show <key> | describe <key>
  db.py score <key> --score N --reason …
  db.py status <key> --status applied [--resume …] [--note …]
  db.py companies [--add name:ats:slug | --deactivate slug]
  db.py filters --kind title_exclude [--add PATTERN]
  db.py stats | report [--date YYYY-MM-DD]
  db.py query "SELECT …"

`list` never returns descriptions. Pull those per key with `describe`.
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

import jobkit

STATUSES = ["new", "scored", "shortlisted", "skipped", "staged", "applied",
            "interviewing", "rejected", "not_pursued", "closed"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Both kinds of board live here. ats in (greenhouse,lever,ashby) is scanned by
-- API; ats='manual' is checked by hand on `cadence`, which is what the old
-- manual-boards.md file used to hold.
CREATE TABLE IF NOT EXISTS companies (
  slug        TEXT NOT NULL,
  ats         TEXT NOT NULL,
  name        TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  added_on    TEXT,
  source      TEXT,
  careers_url TEXT,
  cadence     TEXT,
  last_checked TEXT,
  why         TEXT,
  PRIMARY KEY (ats, slug)
);

CREATE TABLE IF NOT EXISTS filters (
  kind    TEXT NOT NULL,
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
  first_seen   TEXT NOT NULL,
  last_seen    TEXT,
  source       TEXT,
  ats          TEXT,
  description  TEXT,
  score        INTEGER,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  resume       TEXT
);

-- Multi-location postings for one role collapse to a single prospect; the
-- sibling ids live here so they never resurface as new.
CREATE TABLE IF NOT EXISTS aliases (
  alias_key TEXT PRIMARY KEY,
  key       TEXT NOT NULL REFERENCES prospects(key) ON DELETE CASCADE
);

-- What the append-only ledger was for: history, without duplicating the row.
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  key    TEXT NOT NULL REFERENCES prospects(key) ON DELETE CASCADE,
  at     TEXT NOT NULL,
  status TEXT,
  note   TEXT
);

CREATE TABLE IF NOT EXISTS staged (
  key        TEXT PRIMARY KEY REFERENCES prospects(key) ON DELETE CASCADE,
  url        TEXT,
  ats        TEXT,
  screenshot TEXT,
  status     TEXT,
  blocked_on TEXT
);

CREATE TABLE IF NOT EXISTS staged_fields (
  key   TEXT NOT NULL REFERENCES prospects(key) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT,
  tier  TEXT,
  flag  TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_seen   ON prospects(first_seen);
CREATE INDEX IF NOT EXISTS idx_events_key       ON events(key);
"""

LIST_COLUMNS = ("key", "company", "title", "location", "remote", "compensation",
                "posted_at", "first_seen", "source", "score", "status", "resume", "url")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path=None):
    path = path or jobkit.DB
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    con.executescript(SCHEMA)
    return con


def rows_out(rows, as_json):
    rows = [dict(r) for r in rows]
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("(none)")
        return 0
    cols = list(rows[0])
    width = {c: max(len(c), *(len(str(r.get(c) if r.get(c) is not None else "")) for r in rows)) for c in cols}
    width = {c: min(w, 46) for c, w in width.items()}
    print("  ".join(c.ljust(width[c]) for c in cols))
    for r in rows:
        print("  ".join(str(r.get(c) if r.get(c) is not None else "")[:width[c]].ljust(width[c]) for c in cols))
    return 0


# --------------------------------------------------------------------------- commands

def cmd_init(args):
    con = connect(args.db)
    if args.seed:
        cfg = jobkit.load_config(args.seed)
        n_c = n_f = 0
        for c in cfg.get("companies", []):
            con.execute(
                "INSERT OR IGNORE INTO companies(slug,ats,name,active,added_on,source) VALUES(?,?,?,?,?,?)",
                (c["slug"], c["ats"], c["name"], int(c.get("active", True)), jobkit.today(), "seed"))
            n_c += 1
        for kind in ("title_include", "title_exclude", "location_include", "location_exclude",
                     "us_tokens", "title_noise", "agency_name_patterns", "agency_blocklist"):
            for pattern in cfg.get(kind, []):
                con.execute("INSERT OR IGNORE INTO filters(kind,pattern) VALUES(?,?)", (kind, pattern))
                n_f += 1
        for key in ("max_age_days", "comp_floor", "fromage_days", "delay_ms", "shortlist_threshold"):
            if key in cfg:
                con.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (key, str(cfg[key])))
        con.commit()
        print(f"seeded {n_c} companies and {n_f} filters from {args.seed}")
    print(f"database ready: {args.db or jobkit.DB}")
    return 0


def cmd_upsert(args):
    """Insert a newly seen posting, or refresh one already known."""
    con = connect(args.db)
    fields = {k: getattr(args, k) for k in
              ("company", "title", "url", "apply_url", "location", "compensation",
               "posted_at", "source", "ats", "description")
              if getattr(args, k) is not None}
    fields["remote"] = int(args.remote) if args.remote is not None else None
    existing = con.execute("SELECT key FROM prospects WHERE key=?", (args.key,)).fetchone()
    if existing:
        sets = ", ".join(f"{k}=?" for k in fields if fields[k] is not None)
        con.execute(f"UPDATE prospects SET {sets}, last_seen=? WHERE key=?",
                    [v for v in fields.values() if v is not None] + [jobkit.today(), args.key])
        action = "updated"
    else:
        cols = ["key", "first_seen", "last_seen"] + [k for k in fields if fields[k] is not None]
        vals = [args.key, jobkit.today(), jobkit.today()] + [v for v in fields.values() if v is not None]
        con.execute(f"INSERT INTO prospects({','.join(cols)}) VALUES({','.join('?' * len(cols))})", vals)
        con.execute("INSERT INTO events(key,at,status,note) VALUES(?,?,?,?)",
                    (args.key, now(), "new", "first seen"))
        action = "added"
    for alias in args.alias or []:
        con.execute("INSERT OR IGNORE INTO aliases(alias_key,key) VALUES(?,?)", (alias, args.key))
    con.commit()
    print(f"{action} {args.key}")
    return 0


def cmd_score(args):
    con = connect(args.db)
    status = args.status or ("shortlisted" if args.score >= int(
        (con.execute("SELECT value FROM settings WHERE key='shortlist_threshold'").fetchone() or ["7"])[0]
    ) else "skipped")
    n = con.execute("UPDATE prospects SET score=?, reason=?, status=? WHERE key=?",
                    (args.score, args.reason, status, args.key)).rowcount
    if not n:
        sys.exit(f"no prospect with key {args.key!r}")
    con.execute("INSERT INTO events(key,at,status,note) VALUES(?,?,?,?)",
                (args.key, now(), status, args.reason))
    con.commit()
    print(f"{args.key}  {args.score}/10  -> {status}")
    return 0


def cmd_status(args):
    if args.status not in STATUSES:
        sys.exit(f"unknown status {args.status!r}; one of {', '.join(STATUSES)}")
    con = connect(args.db)
    sets, vals = ["status=?"], [args.status]
    if args.resume is not None:
        sets.append("resume=?"); vals.append(args.resume or None)
    n = con.execute(f"UPDATE prospects SET {', '.join(sets)} WHERE key=?", vals + [args.key]).rowcount
    if not n:
        sys.exit(f"no prospect with key {args.key!r}")
    con.execute("INSERT INTO events(key,at,status,note) VALUES(?,?,?,?)",
                (args.key, now(), args.status, args.note))
    con.commit()
    print(f"{args.key} -> {args.status}")
    return 0


def cmd_list(args):
    con = connect(args.db)
    where, vals = [], []
    if args.status:
        where.append(f"status IN ({','.join('?' * len(args.status))})"); vals += args.status
    if args.min_score is not None:
        where.append("score >= ?"); vals.append(args.min_score)
    if args.since:
        where.append("first_seen >= ?"); vals.append(args.since)
    if args.new:
        where.append("status = 'new'")
    if args.company:
        where.append("company LIKE ?"); vals.append(f"%{args.company}%")
    sql = f"SELECT {','.join(LIST_COLUMNS)} FROM prospects"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY COALESCE(score,-1) DESC, first_seen DESC"
    if args.limit:
        sql += f" LIMIT {int(args.limit)}"
    return rows_out(con.execute(sql, vals).fetchall(), args.json)


def cmd_show(args):
    con = connect(args.db)
    row = con.execute("SELECT * FROM prospects WHERE key=?", (args.key,)).fetchone()
    if not row:
        sys.exit(f"no prospect with key {args.key!r}")
    out = dict(row)
    out["events"] = [dict(e) for e in con.execute(
        "SELECT at,status,note FROM events WHERE key=? ORDER BY id", (args.key,)).fetchall()]
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


def cmd_describe(args):
    con = connect(args.db)
    for key in args.key:
        row = con.execute("SELECT company,title,description FROM prospects WHERE key=?", (key,)).fetchone()
        if not row:
            print(f"--- {key}: not found", file=sys.stderr); continue
        print(f"--- {key}  {row['company']} — {row['title']}\n")
        print(row["description"] or "(no description)")
        print()
    return 0


def cmd_companies(args):
    con = connect(args.db)
    for spec in args.add or []:
        name, ats, slug = spec.split(":", 2)
        con.execute("INSERT OR REPLACE INTO companies"
                    "(slug,ats,name,active,added_on,source,careers_url,cadence,why) "
                    "VALUES(?,?,?,1,?,?,?,?,?)",
                    (slug, ats, name, jobkit.today(), args.source or "manual",
                     args.careers_url, args.cadence, args.why))
        print(f"watching {name} ({ats}:{slug})" + (f" — {args.cadence}" if args.cadence else ""))
    for slug in args.checked or []:
        con.execute("UPDATE companies SET last_checked=? WHERE slug=?", (jobkit.today(), slug))
        print(f"checked {slug}")
    for slug in args.deactivate or []:
        con.execute("UPDATE companies SET active=0 WHERE slug=?", (slug,))
        print(f"deactivated {slug}")
    con.commit()
    if args.add or args.deactivate or args.checked:
        return 0
    sql = "SELECT name,ats,slug,active,cadence,last_checked,careers_url,why FROM companies"
    where = [] if args.all else ["active=1"]
    if args.manual:
        where.append("ats='manual'")
    elif args.due:
        where.append("ats='manual'")
    if where:
        sql += " WHERE " + " AND ".join(where)
    return rows_out(con.execute(sql + " ORDER BY name").fetchall(), args.json)


def cmd_filters(args):
    con = connect(args.db)
    for pattern in args.add or []:
        con.execute("INSERT OR IGNORE INTO filters(kind,pattern,note) VALUES(?,?,?)",
                    (args.kind, pattern, args.note))
        print(f"added {args.kind}: {pattern}")
    for pattern in args.remove or []:
        con.execute("DELETE FROM filters WHERE kind=? AND pattern=?", (args.kind, pattern))
        print(f"removed {args.kind}: {pattern}")
    con.commit()
    if args.add or args.remove:
        return 0
    sql, vals = "SELECT kind,pattern,note FROM filters", []
    if args.kind:
        sql += " WHERE kind=?"; vals.append(args.kind)
    return rows_out(con.execute(sql + " ORDER BY kind,pattern", vals).fetchall(), args.json)


def cmd_stage(args):
    """Record a filled-but-unsubmitted application and its fields."""
    con = connect(args.db)
    if not con.execute("SELECT 1 FROM prospects WHERE key=?", (args.key,)).fetchone():
        sys.exit(f"no prospect with key {args.key!r}")
    con.execute("INSERT OR REPLACE INTO staged(key,url,ats,screenshot,status,blocked_on) "
                "VALUES(?,?,?,?,?,?)",
                (args.key, args.url, args.ats, args.screenshot, args.status,
                 "; ".join(args.blocked_on) if args.blocked_on else None))
    con.execute("DELETE FROM staged_fields WHERE key=?", (args.key,))
    for spec in args.field or []:
        parts = spec.split("|")
        if len(parts) < 3:
            sys.exit(f'--field needs "label|value|tier[|flag]", got {spec!r}')
        label, value, tier = parts[0], parts[1], parts[2]
        flag = parts[3] if len(parts) > 3 else None
        con.execute("INSERT INTO staged_fields(key,label,value,tier,flag) VALUES(?,?,?,?,?)",
                    (args.key, label, value, tier, flag))
    con.execute("UPDATE prospects SET status='staged' WHERE key=?", (args.key,))
    con.execute("INSERT INTO events(key,at,status,note) VALUES(?,?,'staged',?)",
                (args.key, now(), args.status))
    con.commit()
    flagged = con.execute("SELECT COUNT(*) n FROM staged_fields WHERE key=? AND flag IS NOT NULL",
                          (args.key,)).fetchone()["n"]
    print(f"staged {args.key} ({args.status})" + (f", {flagged} field(s) flagged" if flagged else ""))
    return 0


def cmd_review(args):
    """Everything staged, with the fields that need a human decision."""
    con = connect(args.db)
    rows = con.execute(
        "SELECT p.key,p.company,p.title,p.score,s.status,s.blocked_on "
        "FROM staged s JOIN prospects p ON p.key=s.key "
        "WHERE p.status='staged' ORDER BY p.score DESC").fetchall()
    if not rows:
        print("(nothing staged)"); return 0
    for r in rows:
        print(f"\n{r['company']} — {r['title']}  ·  {r['score']}/10  ·  {r['status']}")
        if r["blocked_on"]:
            print(f"  BLOCKED: {r['blocked_on']}")
        for f in con.execute("SELECT label,value,tier,flag FROM staged_fields "
                             "WHERE key=? AND flag IS NOT NULL", (r["key"],)).fetchall():
            print(f"  [{f['flag']}] {f['label']}\n      {f['value']}")
        print(f"  key: {r['key']}")
    return 0


def cmd_stats(args):
    con = connect(args.db)
    rows = con.execute("SELECT status, COUNT(*) n FROM prospects GROUP BY status ORDER BY n DESC").fetchall()
    for r in rows:
        print(f"{r['n']:5}  {r['status']}")
    total = con.execute("SELECT COUNT(*) n FROM prospects").fetchone()["n"]
    comp = con.execute("SELECT COUNT(*) n FROM companies WHERE active=1").fetchone()["n"]
    print(f"{total:5}  total prospects   ({comp} companies watched)")
    return 0


def cmd_report(args):
    """What happened on a given day, derived rather than stored."""
    con = connect(args.db)
    day = args.date or jobkit.today()
    seen = con.execute("SELECT COUNT(*) n FROM prospects WHERE first_seen=?", (day,)).fetchone()["n"]
    print(f"# Job run — {day}\n")
    print(f"**New prospects:** {seen}")
    moved = con.execute(
        "SELECT status, COUNT(DISTINCT key) n FROM events WHERE at LIKE ? GROUP BY status",
        (f"{day}%",)).fetchall()
    if moved:
        print("**Moved:** " + " · ".join(f"{r['n']} → {r['status']}" for r in moved))
    print()
    short = con.execute(
        "SELECT key,company,title,score,status,reason,url,resume FROM prospects "
        "WHERE first_seen=? AND score IS NOT NULL AND score>=7 ORDER BY score DESC", (day,)).fetchall()
    if short:
        print("## Shortlisted\n")
        for r in short:
            print(f"### {r['company']} — {r['title']}  ·  **{r['score']}/10**")
            print(f"- **Why:** {r['reason'] or ''}")
            print(f"- **Link:** {r['url'] or ''}")
            if r["resume"]:
                print(f"- **Resume:** `{r['resume']}`")
            print(f"- **Status:** {r['status']}\n")
    rest = con.execute(
        "SELECT company,title,score,reason FROM prospects WHERE first_seen=? AND "
        "(score IS NULL OR score<7) ORDER BY COALESCE(score,-1) DESC", (day,)).fetchall()
    if rest:
        print("## Also new, not shortlisted\n")
        print("| Company | Title | Score | Why not |")
        print("|---|---|---|---|")
        for r in rest:
            print(f"| {r['company']} | {r['title']} | {r['score'] if r['score'] is not None else '—'} | {(r['reason'] or '')[:80]} |")
    return 0


def cmd_query(args):
    con = connect(args.db)
    try:
        cur = con.execute(args.sql)
    except sqlite3.Error as error:
        sys.exit(f"SQL error: {error}")
    if cur.description is None:
        con.commit(); print(f"{cur.rowcount} rows affected"); return 0
    return rows_out(cur.fetchall(), args.json)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=None)
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    # --json is useful after the subcommand too; argparse needs it declared on both.
    jsonable = argparse.ArgumentParser(add_help=False)
    jsonable.add_argument("--json", action="store_true", help="machine-readable output")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("init"); p.add_argument("--seed"); p.set_defaults(func=cmd_init)

    p = sub.add_parser("upsert", help="add or refresh a posting")
    p.add_argument("--key", required=True)
    for f in ("company", "title", "url", "apply_url", "location", "compensation",
              "posted_at", "source", "ats", "description"):
        p.add_argument(f"--{f.replace('_','-')}", dest=f)
    p.add_argument("--remote", type=int)
    p.add_argument("--alias", action="append")
    p.set_defaults(func=cmd_upsert)

    p = sub.add_parser("score"); p.add_argument("key")
    p.add_argument("--score", type=int, required=True); p.add_argument("--reason", required=True)
    p.add_argument("--status"); p.set_defaults(func=cmd_score)

    p = sub.add_parser("status"); p.add_argument("key")
    p.add_argument("--status", required=True); p.add_argument("--resume"); p.add_argument("--note")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("list", help="triage view; never includes descriptions", parents=[jsonable])
    p.add_argument("--status", action="append"); p.add_argument("--min-score", type=int)
    p.add_argument("--since"); p.add_argument("--new", action="store_true")
    p.add_argument("--company"); p.add_argument("--limit", type=int)
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("show", parents=[jsonable]); p.add_argument("key"); p.set_defaults(func=cmd_show)
    p = sub.add_parser("describe", parents=[jsonable]); p.add_argument("key", nargs="+"); p.set_defaults(func=cmd_describe)

    p = sub.add_parser("companies", parents=[jsonable]); p.add_argument("--add", action="append", metavar="NAME:ATS:SLUG")
    p.add_argument("--deactivate", action="append", metavar="SLUG"); p.add_argument("--source")
    p.add_argument("--all", action="store_true"); p.add_argument("--manual", action="store_true")
    p.add_argument("--due", action="store_true", help="manual boards, with when each was last checked")
    p.add_argument("--careers-url"); p.add_argument("--cadence"); p.add_argument("--why")
    p.add_argument("--checked", metavar="SLUG", action="append", help="mark a manual board checked today")
    p.set_defaults(func=cmd_companies)

    p = sub.add_parser("filters", parents=[jsonable]); p.add_argument("--kind"); p.add_argument("--add", action="append")
    p.add_argument("--remove", action="append"); p.add_argument("--note"); p.set_defaults(func=cmd_filters)

    p = sub.add_parser("stage"); p.add_argument("key")
    p.add_argument("--url"); p.add_argument("--ats"); p.add_argument("--screenshot")
    p.add_argument("--status", default="ready", choices=["ready", "blocked"])
    p.add_argument("--blocked-on", action="append")
    p.add_argument("--field", action="append", metavar="LABEL|VALUE|TIER[|FLAG]")
    p.set_defaults(func=cmd_stage)

    sub.add_parser("review", parents=[jsonable]).set_defaults(func=cmd_review)
    sub.add_parser("stats").set_defaults(func=cmd_stats)
    p = sub.add_parser("report"); p.add_argument("--date"); p.set_defaults(func=cmd_report)
    p = sub.add_parser("query", parents=[jsonable]); p.add_argument("sql"); p.set_defaults(func=cmd_query)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
