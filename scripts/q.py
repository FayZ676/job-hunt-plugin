"""Run SQL against the job database.

  q.py "SELECT * FROM triage WHERE status=\'new\'"
  q.py --json "SELECT * FROM triage LIMIT 5"
  q.py -f some.sql          run a file
  q.py --schema             print the schema
  q.py --export > job.sql   dump everything as portable SQL
"""

import argparse
import json
import sqlite3
import sys

import jobkit

READS = {"SELECT", "WITH", "PRAGMA", "EXPLAIN", "VALUES"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sql", nargs="?")
    ap.add_argument("-f", "--file", help="run a .sql file instead")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--schema", action="store_true", help="print the schema and exit")
    ap.add_argument("--export", action="store_true",
                    help="dump the whole database as SQL you can take anywhere")
    ap.add_argument("--db", default=None)
    args = ap.parse_args()

    if args.schema:
        print(open(jobkit.SCHEMA_SQL, encoding="utf-8").read())
        return 0

    if args.export:
        for line in jobkit.connect(args.db).iterdump():
            print(line)
        return 0

    con = jobkit.connect(args.db)
    try:
        if args.file:
            con.executescript(open(args.file, encoding="utf-8").read())
            con.commit()
            print(f"ran {args.file}")
            return 0
        if not args.sql:
            ap.error("give SQL, or -f FILE, or --schema")
        if args.sql.lstrip().split(None, 1)[0].upper() in READS:
            cur = con.execute(args.sql)
        else:
            con.executescript(args.sql)
            cur = con.execute("SELECT changes() AS rows_changed")
    except sqlite3.Error as error:
        sys.exit(f"SQL error: {error}")
    con.commit()

    rows = [dict(r) for r in cur.fetchall()] if cur and cur.description else []
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("(no rows)")
        return 0
    cols = list(rows[0])
    w = {c: min(max(len(c), *(len(str(r.get(c) or "")) for r in rows)), 48) for c in cols}
    print("  ".join(c.ljust(w[c]) for c in cols))
    for r in rows:
        print("  ".join(str(r.get(c) if r.get(c) is not None else "")[:w[c]].ljust(w[c]) for c in cols))
    return 0


if __name__ == "__main__":
    sys.exit(main())
