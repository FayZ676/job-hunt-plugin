"""Phase 5 — present what is staged, submit only what the user names, record it.


  job-submit review                      the approval table: one row per staged application
  job-submit record KEY --confirmation "Application received — #A12"
  job-submit rejected KEY --note "3 days, no interview — resume screen"

Recording an application moves its resume into submitted/ in the same step that
sets `applied`; a rejection deletes that file, and checks it did not come back.
"""

import os
import shutil
import sys

import typer

from jobhunt import jobkit

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)


def companions(pdf):
    stem = os.path.splitext(pdf)[0]
    return [path for path in (pdf, stem + ".json", stem + ".typ") if os.path.isfile(path)]


@app.command()
def review(json: bool = False, db: str = None):
    """the approval table the user reads before naming any"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute(
        "SELECT p.company, p.title, p.score, s.status, s.blocked_on, s.key "
        "FROM staged s JOIN prospects p ON p.key=s.key "
        "WHERE p.status='staged' ORDER BY s.status, p.score DESC").fetchall()]
    jobkit.print_rows(rows, json)
    if rows and not json:
        ready = sum(1 for r in rows if r["status"] == "ready")
        print(f"\n{ready} ready. Nothing goes out until the user names it, in this run.")


@app.command()
def record(key: str,
           confirmation: str = typer.Option(
               ..., help="what the confirmation page said — clicking the button is not evidence"),
           db: str = None):
    """mark applied and move the resume into submitted/"""
    if not confirmation.strip():
        sys.exit("--confirmation cannot be empty: `applied` requires a confirmation page you saw")

    con = jobkit.connect(db)
    row = con.execute(
        "SELECT p.key, p.company, p.title, p.resume, p.status, s.status AS staged_status,"
        "       s.blocked_on FROM prospects p LEFT JOIN staged s ON s.key=p.key WHERE p.key=?",
        (key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {key!r}")
    if row["status"] == "applied":
        sys.exit(f"{key} is already applied")
    if row["staged_status"] is None:
        sys.exit(f"{key} was never staged — run job-stage add first")
    if row["staged_status"] != "ready":
        sys.exit(f"{key} is {row['staged_status']}: {row['blocked_on'] or 'no reason recorded'}")
    if not row["resume"]:
        sys.exit(f"{key} has no resume recorded")

    source = os.path.abspath(os.path.expanduser(row["resume"]))
    if not os.path.isfile(source):
        sys.exit(f"the resume recorded for {key} is not on disk: {source}")

    os.makedirs(jobkit.SUBMITTED, exist_ok=True)
    moved = []
    try:
        for path in companions(source):
            target = os.path.join(jobkit.SUBMITTED, os.path.basename(path))
            shutil.move(path, target)
            moved.append((path, target))
        resume = os.path.join(jobkit.SUBMITTED, os.path.basename(source))
        con.execute("UPDATE postings SET status='applied', resume=? WHERE key=?",
                    (resume, key))
        con.execute("INSERT INTO events(key,status,note) VALUES(?,'applied',?)",
                    (key, confirmation.strip()))
        con.commit()
    except Exception:
        for original, target in reversed(moved):
            if os.path.isfile(target):
                shutil.move(target, original)
        raise

    print(f"{key}  applied")
    print(f"  resume  {resume}")
    print(f"  saw     {confirmation.strip()}")


@app.command()
def rejected(key: str, note: str = typer.Option(...), db: str = None):
    """record a reported rejection and delete its resume"""
    con = jobkit.connect(db)
    row = con.execute("SELECT key, resume, status FROM prospects WHERE key=?",
                      (key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {key!r}")
    if not note.strip():
        sys.exit("--note cannot be empty: record the shape — days elapsed, and any interview stage")

    con.execute("UPDATE postings SET status='rejected', resume=NULL WHERE key=?", (key,))
    con.execute("INSERT INTO events(key,status,note) VALUES(?,'rejected',?)",
                (key, note.strip()))
    con.commit()
    print(f"{key}  rejected")

    if not row["resume"]:
        return
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
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
