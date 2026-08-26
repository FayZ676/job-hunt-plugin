"""Phase 4 — fill the form, record it, and stop with a finger over the button.

  stage.py answers                      what the profile answers: identity and policy
  stage.py missing                      profile fields with no answer — each one blocks
  stage.py add KEY --url URL --ats ashby --screenshot shot.png \
      --field 'Legal right to work without sponsorship?|Yes|policy' \
      --field 'Tell us about an AI product you built|…|judgment|needs-review'
  stage.py show KEY                     every field staged for one application
  stage.py list                         everything staged, and what each is blocked on
  stage.py drop KEY                     unstage, back to shortlisted

`ready` and `blocked` are derived, never asserted: a field staged with no value
blocks the application and names itself in blocked_on.
"""

import argparse
import os
import sys

from jobhunt import jobkit

TIERS = ("identity", "policy", "judgment")
CLOSED = ("applied", "rejected", "closed")


def parse_field(raw):
    parts = raw.split("|")
    if len(parts) < 3:
        sys.exit(f"--field wants 'label|value|tier' or 'label|value|tier|flag', got {raw!r}")
    label, value, tier = parts[0].strip(), parts[1].strip(), parts[2].strip()
    flag = parts[3].strip() if len(parts) > 3 and parts[3].strip() else None
    if tier not in TIERS:
        sys.exit(f"tier must be one of {', '.join(TIERS)}, got {tier!r} on {label!r}")
    if not label:
        sys.exit(f"a field needs a label: {raw!r}")
    return label, value, tier, flag


def cmd_answers(args):
    con = jobkit.connect(args.db)
    rows = [dict(r) for r in con.execute(
        "SELECT section, field, value, notes FROM profile WHERE value IS NOT NULL "
        "ORDER BY section, field").fetchall()]
    return jobkit.print_rows(rows, args.json)


def cmd_missing(args):
    con = jobkit.connect(args.db)
    rows = [dict(r) for r in con.execute("SELECT field, section FROM unanswered").fetchall()]
    jobkit.print_rows(rows, args.json)
    if rows and not args.json:
        print(f"\n{len(rows)} unanswered — a form asking for one of these blocks, never guesses")
    return 0


def cmd_add(args):
    con = jobkit.connect(args.db)
    row = con.execute(
        "SELECT key, company, title, status, resume FROM prospects WHERE key=?",
        (args.key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {args.key!r}")
    if row["status"] in CLOSED:
        sys.exit(f"{args.key} is already {row['status']} — nothing to stage")
    if not row["resume"]:
        sys.exit(f"{args.key} has no resume — build it first: resume.py build <spec> --key {args.key}")
    if not os.path.isfile(os.path.expanduser(row["resume"])):
        sys.exit(f"the resume recorded for {args.key} is not on disk: {row['resume']}")

    screenshot = os.path.abspath(os.path.expanduser(args.screenshot))
    if not os.path.isfile(screenshot):
        sys.exit(f"no screenshot at {screenshot} — Phase 4 ends with the filled form captured")

    fields = [parse_field(raw) for raw in args.field]
    if not fields:
        sys.exit("stage at least one --field: an application with no recorded answers is not staged")

    empty = [label for label, value, _, _ in fields if not value]
    blocked_on = args.blocked_on or (
        "no answer for: " + "; ".join(empty) if empty else None)
    status = "blocked" if blocked_on else "ready"

    con.execute(
        "INSERT INTO staged(key,url,ats,screenshot,status,blocked_on) VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(key) DO UPDATE SET url=excluded.url, ats=excluded.ats,"
        "  screenshot=excluded.screenshot, status=excluded.status, blocked_on=excluded.blocked_on",
        (args.key, args.url, args.ats, screenshot, status, blocked_on))
    con.execute("DELETE FROM staged_fields WHERE key=?", (args.key,))
    con.executemany(
        "INSERT INTO staged_fields(key,label,value,tier,flag) VALUES(?,?,?,?,?)",
        [(args.key, label, value or None, tier, flag) for label, value, tier, flag in fields])
    con.execute("UPDATE prospects SET status='staged' WHERE key=?", (args.key,))
    con.commit()

    flagged = [label for label, _, _, flag in fields if flag]
    print(f"{args.key}  {status}  {len(fields)} fields")
    if blocked_on:
        print(f"  blocked_on: {blocked_on}")
    if flagged:
        print("  flagged for review: " + "; ".join(flagged))
    return 0


def cmd_show(args):
    con = jobkit.connect(args.db)
    row = con.execute(
        "SELECT s.key, p.company, p.title, s.url, s.ats, s.status, s.blocked_on, s.screenshot,"
        "       p.resume FROM staged s JOIN prospects p ON p.key=s.key WHERE s.key=?",
        (args.key,)).fetchone()
    if not row:
        sys.exit(f"nothing staged for {args.key!r}")
    print(f"{row['company']} — {row['title']}  [{row['key']}]  {row['status']}")
    if row["blocked_on"]:
        print(f"  blocked_on: {row['blocked_on']}")
    print(f"  {row['ats'] or '?'}  {row['url'] or ''}")
    print(f"  resume     {row['resume']}")
    print(f"  screenshot {row['screenshot']}\n")
    fields = [dict(r) for r in con.execute(
        "SELECT tier, label, value, flag FROM staged_fields WHERE key=? ORDER BY rowid",
        (args.key,)).fetchall()]
    return jobkit.print_rows(fields, args.json)


def cmd_list(args):
    con = jobkit.connect(args.db)
    rows = [dict(r) for r in con.execute(
        "SELECT s.key, p.company, p.title, p.score, s.ats, s.status, p.status AS prospect, "
        "       s.blocked_on FROM staged s JOIN prospects p ON p.key=s.key "
        "ORDER BY s.status, p.score DESC").fetchall()]
    return jobkit.print_rows(rows, args.json)


def cmd_drop(args):
    con = jobkit.connect(args.db)
    if not con.execute("SELECT 1 FROM staged WHERE key=?", (args.key,)).fetchone():
        sys.exit(f"nothing staged for {args.key!r}")
    con.execute("DELETE FROM staged_fields WHERE key=?", (args.key,))
    con.execute("DELETE FROM staged WHERE key=?", (args.key,))
    con.execute("UPDATE prospects SET status='shortlisted' WHERE key=? AND status='staged'",
                (args.key,))
    con.commit()
    print(f"{args.key} unstaged")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    a = sub.add_parser("answers", help="the profile answers identity and policy fields draw from")
    a.add_argument("--json", action="store_true")
    a.add_argument("--db", default=None)
    a.set_defaults(func=cmd_answers)

    m = sub.add_parser("missing", help="profile fields with no answer — each one blocks")
    m.add_argument("--json", action="store_true")
    m.add_argument("--db", default=None)
    m.set_defaults(func=cmd_missing)

    d = sub.add_parser("add", help="record a filled form; status is derived from the fields")
    d.add_argument("key")
    d.add_argument("--url", required=True, help="the apply URL the form was filled at")
    d.add_argument("--ats", required=True)
    d.add_argument("--screenshot", required=True, help="the completed form, captured")
    d.add_argument("--field", action="append", default=[],
                   metavar="'label|value|tier[|flag]'")
    d.add_argument("--blocked-on", help="what is missing, when the block is not an empty field")
    d.add_argument("--db", default=None)
    d.set_defaults(func=cmd_add)

    s = sub.add_parser("show", help="every field staged for one application")
    s.add_argument("key")
    s.add_argument("--json", action="store_true")
    s.add_argument("--db", default=None)
    s.set_defaults(func=cmd_show)

    l = sub.add_parser("list", help="everything staged, and what each is blocked on")
    l.add_argument("--json", action="store_true")
    l.add_argument("--db", default=None)
    l.set_defaults(func=cmd_list)

    r = sub.add_parser("drop", help="unstage, back to shortlisted")
    r.add_argument("key")
    r.add_argument("--db", default=None)
    r.set_defaults(func=cmd_drop)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
