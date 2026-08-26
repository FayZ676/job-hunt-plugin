"""Run SQL against the job database.

\b
  job-q "SELECT * FROM triage WHERE status='new'"
  job-q --json "SELECT * FROM triage LIMIT 5"
  job-q -f some.sql          run a file
  job-q --schema             print the schema
  job-q --export > job.sql   dump everything as portable SQL
"""

import sqlite3
import sys

import typer

from jobhunt import jobkit

app = typer.Typer(rich_markup_mode=None, add_completion=False)

READS = {"SELECT", "WITH", "PRAGMA", "EXPLAIN", "VALUES"}


@app.command(help=__doc__)
def main(sql: str = typer.Argument(None),
         file: str = typer.Option(None, "-f", "--file", help="run a .sql file instead"),
         json: bool = False,
         schema: bool = typer.Option(False, help="print the schema and exit"),
         export: bool = typer.Option(
             False, help="dump the whole database as SQL you can take anywhere"),
         db: str = None):
    if schema:
        print(open(jobkit.SCHEMA_SQL, encoding="utf-8").read())
        return

    if export:
        for line in jobkit.connect(db).iterdump():
            print(line)
        return

    con = jobkit.connect(db)
    try:
        if file:
            con.executescript(open(file, encoding="utf-8").read())
            con.commit()
            print(f"ran {file}")
            return
        if not sql:
            sys.exit("give SQL, or -f FILE, or --schema")
        if sql.lstrip().split(None, 1)[0].upper() in READS:
            cur = con.execute(sql)
        else:
            con.executescript(sql)
            cur = con.execute("SELECT changes() AS rows_changed")
    except sqlite3.Error as error:
        sys.exit(f"SQL error: {error}")
    con.commit()

    rows = [dict(r) for r in cur.fetchall()] if cur and cur.description else []
    jobkit.print_rows(rows, json)


def cli():
    app()


if __name__ == "__main__":
    cli()
