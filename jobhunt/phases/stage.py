"""Phase 4 — fill the form, record it, and stop with a finger over the button.


  job-stage answers                      what the profile answers: identity and policy
  job-stage missing                      profile fields with no answer — each one blocks
  job-stage add KEY --url URL --ats ashby --screenshot shot.png
      --field 'Legal right to work without sponsorship?|Yes|policy'
      --field 'Tell us about an AI product you built|…|judgment|needs-review'
  job-stage show KEY                     every field staged for one application
  job-stage list                         everything staged, and what each is blocked on
  job-stage drop KEY                     unstage, back to shortlisted

`ready` and `blocked` are derived, never asserted: a field staged with no value
blocks the application and names itself in blocked_on.
"""

import os
import sys

import typer

from jobhunt import jobkit

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)

TIERS = sorted(jobkit.vocabulary("staged_fields", "tier"))
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


@app.command()
def answers(json: bool = False, db: str = None):
    """the profile answers identity and policy fields draw from"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute(
        "SELECT section, field, value, notes FROM profile WHERE value IS NOT NULL "
        "ORDER BY section, field").fetchall()]
    jobkit.print_rows(rows, json)


@app.command()
def missing(json: bool = False, db: str = None):
    """profile fields with no answer — each one blocks"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute("SELECT field, section FROM unanswered").fetchall()]
    jobkit.print_rows(rows, json)
    if rows and not json:
        print(f"\n{len(rows)} unanswered — a form asking for one of these blocks, never guesses")


@app.command()
def add(key: str,
        url: str = typer.Option(..., help="the apply URL the form was filled at"),
        ats: str = typer.Option(...),
        screenshot: str = typer.Option(..., help="the completed form, captured"),
        field: list[str] = typer.Option(None, metavar="'label|value|tier[|flag]'"),
        blocked_on: str = typer.Option(
            None, help="what is missing, when the block is not an empty field"),
        db: str = None):
    """record a filled form; status is derived from the fields"""
    con = jobkit.connect(db)
    row = con.execute(
        "SELECT key, company, title, status, resume FROM prospects WHERE key=?",
        (key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {key!r}")
    if row["status"] in CLOSED:
        sys.exit(f"{key} is already {row['status']} — nothing to stage")
    if not row["resume"]:
        sys.exit(f"{key} has no resume — build it first: job-resume build <spec> --key {key}")
    if not os.path.isfile(os.path.expanduser(row["resume"])):
        sys.exit(f"the resume recorded for {key} is not on disk: {row['resume']}")

    screenshot = os.path.abspath(os.path.expanduser(screenshot))
    if not os.path.isfile(screenshot):
        sys.exit(f"no screenshot at {screenshot} — Phase 4 ends with the filled form captured")

    if not field:
        sys.exit("stage at least one --field: an application with no recorded answers is not staged")
    fields = [parse_field(raw) for raw in field]

    empty = [label for label, value, _, _ in fields if not value]
    blocked_on = blocked_on or (
        "no answer for: " + "; ".join(empty) if empty else None)
    status = "blocked" if blocked_on else "ready"

    con.execute(
        "INSERT INTO staged(key,url,ats,screenshot,status,blocked_on) VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(key) DO UPDATE SET url=excluded.url, ats=excluded.ats,"
        "  screenshot=excluded.screenshot, status=excluded.status, blocked_on=excluded.blocked_on",
        (key, url, ats, screenshot, status, blocked_on))
    con.execute("DELETE FROM staged_fields WHERE key=?", (key,))
    con.executemany(
        "INSERT INTO staged_fields(key,label,value,tier,flag) VALUES(?,?,?,?,?)",
        [(key, label, value or None, tier, flag) for label, value, tier, flag in fields])
    con.execute("UPDATE postings SET status='staged' WHERE key=?", (key,))
    con.commit()

    flagged = [label for label, _, _, flag in fields if flag]
    print(f"{key}  {status}  {len(fields)} fields")
    if blocked_on:
        print(f"  blocked_on: {blocked_on}")
    if flagged:
        print("  flagged for review: " + "; ".join(flagged))


@app.command()
def show(key: str, json: bool = False, db: str = None):
    """every field staged for one application"""
    con = jobkit.connect(db)
    row = con.execute(
        "SELECT s.key, p.company, p.title, s.url, s.ats, s.status, s.blocked_on, s.screenshot,"
        "       p.resume FROM staged s JOIN prospects p ON p.key=s.key WHERE s.key=?",
        (key,)).fetchone()
    if not row:
        sys.exit(f"nothing staged for {key!r}")
    print(f"{row['company']} — {row['title']}  [{row['key']}]  {row['status']}")
    if row["blocked_on"]:
        print(f"  blocked_on: {row['blocked_on']}")
    print(f"  {row['ats'] or '?'}  {row['url'] or ''}")
    print(f"  resume     {row['resume']}")
    print(f"  screenshot {row['screenshot']}\n")
    fields = [dict(r) for r in con.execute(
        "SELECT tier, label, value, flag FROM staged_fields WHERE key=? ORDER BY rowid",
        (key,)).fetchall()]
    jobkit.print_rows(fields, json)


@app.command("list")
def list_staged(json: bool = False, db: str = None):
    """everything staged, and what each is blocked on"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute(
        "SELECT s.key, p.company, p.title, p.score, s.ats, s.status, p.status AS prospect, "
        "       s.blocked_on FROM staged s JOIN prospects p ON p.key=s.key "
        "ORDER BY s.status, p.score DESC").fetchall()]
    jobkit.print_rows(rows, json)


@app.command()
def drop(key: str, db: str = None):
    """unstage, back to shortlisted"""
    con = jobkit.connect(db)
    if not con.execute("SELECT 1 FROM staged WHERE key=?", (key,)).fetchone():
        sys.exit(f"nothing staged for {key!r}")
    con.execute("DELETE FROM staged_fields WHERE key=?", (key,))
    con.execute("DELETE FROM staged WHERE key=?", (key,))
    con.execute("UPDATE postings SET status='shortlisted' WHERE key=? AND status='staged'",
                (key,))
    con.commit()
    print(f"{key} unstaged")


if __name__ == "__main__":
    app()
