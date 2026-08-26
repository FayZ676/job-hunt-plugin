"""The profile — the user's own answers, and the only thing they own.


  job-profile set identity.email you@example.com
  job-profile set availability.notice_period '2 weeks' --notes 'negotiable to 1'
  job-profile clear identity.phone       back to unanswered — a hard stop again
  job-profile answers                    what the profile answers
  job-profile missing                    every unanswered field, each one a hard stop

The section is never typed or stored twice: it is the part of the field before
the dot, so `availability.notice_period` files itself. A field naming no known
section is refused rather than filed somewhere new.
"""

import sys

import typer

from jobhunt import jobkit
from jobhunt.models import Profile, ValidationError

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)


@app.command("set")
def set_(field: str, value: str, notes: str = typer.Option(None), db: str = None):
    """answer one field, or correct the answer it already has"""
    try:
        row = Profile(field=field, value=value, notes=notes).row()
    except ValidationError as bad:
        sys.exit("; ".join(e["msg"].removeprefix("Value error, ") for e in bad.errors()))
    con = jobkit.connect(db)
    con.execute(
        "INSERT INTO profile(field,value,notes) VALUES(:field,:value,:notes) "
        "ON CONFLICT(field) DO UPDATE SET value=excluded.value,"
        "  notes=COALESCE(excluded.notes, profile.notes)", row)
    con.commit()
    print(f"{field} = {value}")


@app.command()
def clear(field: str, db: str = None):
    """drop an answer — the field goes back to blocking"""
    con = jobkit.connect(db)
    if not con.execute("UPDATE profile SET value=NULL WHERE field=?", (field,)).rowcount:
        sys.exit(f"no profile field {field!r}")
    con.commit()
    print(f"{field} unanswered — it blocks any form that asks for it")


@app.command()
def answers(json: bool = False, db: str = None):
    """what the profile answers"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute(
        "SELECT section, field, value, notes FROM profile WHERE value IS NOT NULL "
        "ORDER BY section, field").fetchall()]
    jobkit.print_rows(rows, json)


@app.command()
def missing(json: bool = False, db: str = None):
    """every unanswered field — each one blocks"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute("SELECT field, section FROM unanswered").fetchall()]
    jobkit.print_rows(rows, json)
    if rows and not json:
        print(f"\n{len(rows)} unanswered — a form asking for one of these blocks, never guesses")


if __name__ == "__main__":
    app()
