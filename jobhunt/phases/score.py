"""Phase 2 — score every prospect against the search profile.


  job-score triage                        the cheap list: no descriptions, on purpose
  job-score triage --status new
  job-score rubric                        search_criteria and search_notes, what scoring reads
  job-score show KEY [KEY ...]            full text, for survivors only
  job-score set KEY --score 9 --reason "the JD language that drove it, quoted"
  job-score pending                       what is still unscored and will come back tomorrow

A score sets the status by the threshold in settings, so the two cannot disagree.
"""

import sys

import typer

from jobhunt import jobkit

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)


@app.command()
def triage(status: str = None, limit: int = 0, json: bool = False, db: str = None):
    """the triage view: no descriptions, on purpose"""
    con = jobkit.connect(db)
    sql = "SELECT * FROM triage" + (" WHERE status=?" if status else "")
    if limit:
        sql += f" LIMIT {limit}"
    params = (status,) if status else ()
    jobkit.print_rows([dict(r) for r in con.execute(sql, params).fetchall()], json)


@app.command()
def rubric(db: str = None):
    """the criteria and notes scoring reads"""
    con = jobkit.connect(db)
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


@app.command()
def show(key: list[str], db: str = None):
    """full description for the prospects that survived triage"""
    con = jobkit.connect(db)
    for one in key:
        row = con.execute(
            "SELECT key, company, title, location, remote, compensation, posted_at, url, "
            "score, status, description FROM prospects WHERE key=?", (one,)).fetchone()
        if not row:
            print(f"no prospect {one!r}", file=sys.stderr)
            continue
        print(f"{row['company']} — {row['title']}  [{row['key']}]")
        print(f"  {row['location'] or '(no location)'}"
              f"{'  remote' if row['remote'] else ''}"
              f"{'  ' + row['compensation'] if row['compensation'] else ''}")
        print(f"  posted {row['posted_at'] or 'unknown'}   {row['status']}"
              f"{'  score ' + str(row['score']) if row['score'] is not None else ''}")
        print(f"  {row['url'] or ''}\n")
        print(row["description"] or "(no description — job-score set will refuse this one)")
        print("\n" + "-" * 78 + "\n")


@app.command("set")
def set_score(key: str, score: int = typer.Option(...), reason: str = typer.Option(...),
              db: str = None):
    """record a score and the reason that drove it"""
    con = jobkit.connect(db)
    row = con.execute(
        "SELECT key, description, status FROM prospects WHERE key=?", (key,)).fetchone()
    if not row:
        sys.exit(f"no prospect {key!r}")
    if not 0 <= score <= 10:
        sys.exit(f"score must be 0-10, got {score}")
    if not reason.strip():
        sys.exit("--reason cannot be empty: name the JD language that drove the score")
    if not (row["description"] or "").strip():
        sys.exit(f"{key} has no description — scoring off a title is what this phase "
                 "exists to prevent. Attach one first: job-scan descriptions --file <descs.json>")

    con.execute("UPDATE postings SET score=?, reason=? WHERE key=?", (score, reason.strip(), key))
    con.commit()
    after = con.execute("SELECT score, status FROM prospects WHERE key=?", (key,)).fetchone()
    print(f"{key}  {after['score']}  {after['status']}")


@app.command()
def pending(json: bool = False, db: str = None):
    """prospects with no score yet"""
    con = jobkit.connect(db)
    rows = [dict(r) for r in con.execute(
        "SELECT key, company, title, location, first_seen FROM prospects "
        "WHERE score IS NULL ORDER BY first_seen DESC").fetchall()]
    jobkit.print_rows(rows, json)
    if rows and not json:
        print(f"\n{len(rows)} unscored — each one stays `new` and comes back tomorrow")


if __name__ == "__main__":
    app()
