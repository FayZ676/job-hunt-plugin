"""The profile — the user's own answers, and the only thing they own.


  job-profile set identity.email you@example.com
  job-profile set availability.notice_period '2 weeks'
  job-profile clear identity.phone       back to unanswered — a hard stop again
  job-profile answers                    what the profile answers
  job-profile missing                    every unanswered field, each one a hard stop

Every field a form can ask for is declared in sql/profile.sql and exists as a
row from the first connect, so answering is always an update: a name that is not
declared is refused rather than filed as a new field. Something genuinely
missing is a change to that list, not a row invented here.

The section is never typed or stored twice: it is the part of the field before
the dot, so `availability.notice_period` files itself.
"""

from typing import Annotated

import typer

from jobhunt import jobkit
from jobhunt.models import Profile, ProfileField

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)

FIELD = Annotated[ProfileField, typer.Argument(metavar="<section>.<name>", show_choices=False)]


@app.command("set")
def set_(field: FIELD, value: str, db: str = None):
    """answer one field, or correct the answer it already has"""
    row = Profile(field=field, value=value).row()
    con = jobkit.connect(db)
    con.execute(
        "INSERT INTO profile(field,value) VALUES(:field,:value) "
        "ON CONFLICT(field) DO UPDATE SET value=excluded.value", row)
    con.commit()
    print(f"{field} = {value}")


@app.command()
def clear(field: FIELD, db: str = None):
    """drop an answer — the field goes back to blocking"""
    con = jobkit.connect(db)
    con.execute("UPDATE profile SET value=NULL WHERE field=?", (field,))
    con.commit()
    print(f"{field} unanswered — it blocks any form that asks for it")


@app.command()
def answers(json: bool = False, db: str = None):
    """what the profile answers"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute(
        "SELECT section, field, value FROM profile WHERE value IS NOT NULL "
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
