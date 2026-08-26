"""Phase 5 — present what is staged, submit only what the user names, record it.

  submit.py review                      the approval table: one row per staged application
  submit.py record KEY --confirmation "Application received — #A12"
  submit.py rejected KEY --note "3 days, no interview — resume screen"

Recording an application moves its resume into submitted/ in the same step that
sets `applied`; a rejection deletes that file, and checks it did not come back.
"""

import argparse
import os
import shutil
import sys

from jobhunt import jobkit


def companions(pdf):
    stem = os.path.splitext(pdf)[0]
    return [path for path in (pdf, stem + ".json", stem + ".typ") if os.path.isfile(path)]


def cmd_review(args):
    con = jobkit.connect(args.db)
    rows = [dict(r) for r in con.execute(
        "SELECT p.company, p.title, p.score, s.status, s.blocked_on, s.key "
        "FROM staged s JOIN prospects p ON p.key=s.key "
        "WHERE p.status='staged' ORDER BY s.status, p.score DESC").fetchall()]
    jobkit.print_rows(rows, args.json)
    if rows and not args.json:
        ready = sum(1 for r in rows if r["status"] == "ready")
        print(f"\n{ready} ready. Nothing goes out until the user names it, in this run.")
    return 0


def cmd_record(args):
    if not args.confirmation.strip():
        sys.exit("--confirmation cannot be empty: `applied` requires a confirmation page you saw")

    con = jobkit.connect(args.db)
    row = con.execute(
        "SELECT p.key, p.company, p.title, p.resume, p.status, s.status AS staged_status,"
        "       s.blocked_on FROM prospects p LEFT JOIN staged s ON s.key=p.key WHERE p.key=?",
        (args.key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {args.key!r}")
    if row["status"] == "applied":
        sys.exit(f"{args.key} is already applied")
    if row["staged_status"] is None:
        sys.exit(f"{args.key} was never staged — run stage.py add first")
    if row["staged_status"] != "ready":
        sys.exit(f"{args.key} is {row['staged_status']}: {row['blocked_on'] or 'no reason recorded'}")
    if not row["resume"]:
        sys.exit(f"{args.key} has no resume recorded")

    source = os.path.abspath(os.path.expanduser(row["resume"]))
    if not os.path.isfile(source):
        sys.exit(f"the resume recorded for {args.key} is not on disk: {source}")

    os.makedirs(jobkit.SUBMITTED, exist_ok=True)
    moved = []
    try:
        for path in companions(source):
            target = os.path.join(jobkit.SUBMITTED, os.path.basename(path))
            shutil.move(path, target)
            moved.append((path, target))
        resume = os.path.join(jobkit.SUBMITTED, os.path.basename(source))
        con.execute("UPDATE prospects SET status='applied', resume=? WHERE key=?",
                    (resume, args.key))
        con.execute("INSERT INTO events(key,status,note) VALUES(?,'applied',?)",
                    (args.key, args.confirmation.strip()))
        con.commit()
    except Exception:
        for original, target in reversed(moved):
            if os.path.isfile(target):
                shutil.move(target, original)
        raise

    print(f"{args.key}  applied")
    print(f"  resume  {resume}")
    print(f"  saw     {args.confirmation.strip()}")
    return 0


def cmd_rejected(args):
    con = jobkit.connect(args.db)
    row = con.execute("SELECT key, resume, status FROM prospects WHERE key=?",
                      (args.key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {args.key!r}")
    if not args.note.strip():
        sys.exit("--note cannot be empty: record the shape — days elapsed, and any interview stage")

    con.execute("UPDATE prospects SET status='rejected', resume=NULL WHERE key=?", (args.key,))
    con.execute("INSERT INTO events(key,status,note) VALUES(?,'rejected',?)",
                (args.key, args.note.strip()))
    con.commit()
    print(f"{args.key}  rejected")

    if not row["resume"]:
        return 0
    stubborn = []
    for path in companions(os.path.abspath(os.path.expanduser(row["resume"]))):
        for _ in range(3):
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
            if not os.path.isfile(path):
                break
        if os.path.isfile(path):
            stubborn.append(path)
        else:
            print(f"  deleted {path}")
    if stubborn:
        print("\na synced folder keeps re-materializing these — delete them by hand:")
        for path in stubborn:
            print(f"  {path}")
        return 1
    return 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    v = sub.add_parser("review", help="the approval table the user reads before naming any")
    v.add_argument("--json", action="store_true")
    v.add_argument("--db", default=None)
    v.set_defaults(func=cmd_review)

    r = sub.add_parser("record", help="mark applied and move the resume into submitted/")
    r.add_argument("key")
    r.add_argument("--confirmation", required=True,
                   help="what the confirmation page said — clicking the button is not evidence")
    r.add_argument("--db", default=None)
    r.set_defaults(func=cmd_record)

    x = sub.add_parser("rejected", help="record a reported rejection and delete its resume")
    x.add_argument("key")
    x.add_argument("--note", required=True)
    x.add_argument("--db", default=None)
    x.set_defaults(func=cmd_rejected)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
