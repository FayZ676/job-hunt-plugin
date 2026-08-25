"""Phase 2 — score every prospect against the search profile.

  score.py triage                        the cheap list: no descriptions, on purpose
  score.py triage --status new
  score.py rubric                        search_criteria and search_notes, what scoring reads
  score.py show KEY [KEY ...]            full text, for survivors only
  score.py set KEY --score 9 --reason "the JD language that drove it, quoted"
  score.py pending                       what is still unscored and will come back tomorrow

A score sets the status by the threshold in settings, so the two cannot disagree.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))

import jobkit


def cmd_triage(args):
    con = jobkit.connect(args.db)
    sql = "SELECT * FROM triage"
    params = ()
    if args.status:
        sql += " WHERE status=?"
        params = (args.status,)
    if args.limit:
        sql += f" LIMIT {int(args.limit)}"
    return jobkit.print_rows([dict(r) for r in con.execute(sql, params).fetchall()], args.json)


def cmd_rubric(args):
    con = jobkit.connect(args.db)
    for row in con.execute(
            "SELECT kind, value, weight, note FROM search_criteria ORDER BY kind, seq, value"):
        weight = f"  {row['weight']:+d}" if row["weight"] is not None else ""
        note = f"    {row['note']}" if row["note"] else ""
        print(f"{row['kind']:<18}  {row['value']}{weight}{note}")
    notes = con.execute("SELECT topic, note FROM search_notes ORDER BY topic").fetchall()
    if notes:
        print("\nsearch_notes — judgement the rubric cannot hold; read every pass\n")
        for row in notes:
            print(f"  {row['topic']}\n    {row['note']}\n")
    return 0


def cmd_show(args):
    con = jobkit.connect(args.db)
    for key in args.key:
        row = con.execute(
            "SELECT key, company, title, location, remote, compensation, posted_at, url, "
            "score, status, description FROM prospects WHERE key=?", (key,)).fetchone()
        if not row:
            print(f"no prospect {key!r}", file=sys.stderr)
            continue
        print(f"{row['company']} — {row['title']}  [{row['key']}]")
        print(f"  {row['location'] or '(no location)'}"
              f"{'  remote' if row['remote'] else ''}"
              f"{'  ' + row['compensation'] if row['compensation'] else ''}")
        print(f"  posted {row['posted_at'] or 'unknown'}   {row['status']}"
              f"{'  score ' + str(row['score']) if row['score'] is not None else ''}")
        print(f"  {row['url'] or ''}\n")
        print(row["description"] or "(no description — score.py set will refuse this one)")
        print("\n" + "-" * 78 + "\n")
    return 0


def cmd_set(args):
    con = jobkit.connect(args.db)
    row = con.execute(
        "SELECT key, description, status FROM prospects WHERE key=?", (args.key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {args.key!r}")
    if not 0 <= args.score <= 10:
        sys.exit(f"score must be 0-10, got {args.score}")
    if not args.reason.strip():
        sys.exit("--reason cannot be empty: name the JD language that drove the score")
    if not (row["description"] or "").strip():
        sys.exit(f"{args.key} has no description — scoring off a title is what this phase "
                 "exists to prevent. Attach one first: scan.py descriptions --file <descs.json>")

    con.execute("UPDATE prospects SET score=?, reason=? WHERE key=?",
                (args.score, args.reason.strip(), args.key))
    con.commit()
    after = con.execute("SELECT score, status FROM prospects WHERE key=?", (args.key,)).fetchone()
    print(f"{args.key}  {after['score']}  {after['status']}")
    return 0


def cmd_pending(args):
    con = jobkit.connect(args.db)
    rows = [dict(r) for r in con.execute(
        "SELECT key, company, title, location, first_seen FROM prospects "
        "WHERE score IS NULL ORDER BY first_seen DESC").fetchall()]
    jobkit.print_rows(rows, args.json)
    if rows and not args.json:
        print(f"\n{len(rows)} unscored — each one stays `new` and comes back tomorrow")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    t = sub.add_parser("triage", help="the triage view: no descriptions, on purpose")
    t.add_argument("--status")
    t.add_argument("--limit", type=int)
    t.add_argument("--json", action="store_true")
    t.add_argument("--db", default=None)
    t.set_defaults(func=cmd_triage)

    r = sub.add_parser("rubric", help="the criteria and notes scoring reads")
    r.add_argument("--db", default=None)
    r.set_defaults(func=cmd_rubric)

    s = sub.add_parser("show", help="full description for the prospects that survived triage")
    s.add_argument("key", nargs="+")
    s.add_argument("--db", default=None)
    s.set_defaults(func=cmd_show)

    w = sub.add_parser("set", help="record a score and the reason that drove it")
    w.add_argument("key")
    w.add_argument("--score", type=int, required=True)
    w.add_argument("--reason", required=True)
    w.add_argument("--db", default=None)
    w.set_defaults(func=cmd_set)

    p = sub.add_parser("pending", help="prospects with no score yet")
    p.add_argument("--json", action="store_true")
    p.add_argument("--db", default=None)
    p.set_defaults(func=cmd_pending)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
