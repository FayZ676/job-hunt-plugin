import sqlite3
from typing import Annotated

import typer

from jobhunt import jobkit
from jobhunt.models import ProfileField

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)

FIELD = Annotated[ProfileField, typer.Argument(metavar="<section>.<name>", show_choices=False)]


@app.command("set")
def set_(field: FIELD, value: str, db: str = None):
    """answer one field, or correct the answer it already has"""
    section, _, column = field.partition(".")
    con = jobkit.connect(db)
    try:
        con.execute(f"UPDATE {section} SET {column}=? WHERE id=1", (value.strip(),))
    except sqlite3.IntegrityError:
        print(f"{value!r} is not an answer to {field} — it takes {jobkit.takes(section, column)}")
        raise typer.Exit(1)
    con.commit()
    print(f"{field} = {value}")


@app.command()
def clear(field: FIELD, db: str = None):
    """drop an answer — the field goes back to blocking"""
    section, _, column = field.partition(".")
    con = jobkit.connect(db)
    con.execute(f"UPDATE {section} SET {column}=NULL WHERE id=1")
    con.commit()
    print(f"{field} unanswered — it blocks any form that asks for it")


@app.command()
def answers(json: bool = False, db: str = None):
    """what the profile answers"""
    con = jobkit.connect(db)
    rows = []
    for section in jobkit.sections():
        columns = jobkit.columns(section)
        held = con.execute(f"SELECT {','.join(columns)} FROM {section} WHERE id=1").fetchone()
        rows += [{"section": section, "field": name, "value": held[name]}
                 for name in columns if held[name] is not None]
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
