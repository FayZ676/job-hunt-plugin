"""Phase 1 — fetch postings, then rule on them. Two steps, and they stay separate.


  job-scan sources                          the registry: kind, rank, endpoint
  job-scan boards                           every active board, in parallel
  job-scan boards --company Anthropic       one board, for testing a new slug
  job-scan harvest --source indeed --file harvest.json
  job-scan descriptions --file descs.json   descriptions for rows ingest kept
  job-scan ingest                           postings -> prospects, no network
  job-scan ingest --redo --no-location-filter
  job-scan dispositions                     every verdict, in the order ruled
"""

import concurrent.futures
import json
import sys

import typer

from jobhunt import jobkit, sources
from jobhunt.jobkit import MAX_DESCRIPTION_CHARS, age_days, compile_patterns, matches_any, norm, norm_company
from jobhunt.models import Posting

app = typer.Typer(help=__doc__, no_args_is_help=True,
                  rich_markup_mode=None, add_completion=False)

POSTING_COLUMNS = tuple(Posting.model_fields)


def store(con, postings):
    known = {r["key"] for r in con.execute("SELECT key FROM postings").fetchall()}
    fresh = 0
    for posting in postings:
        row = posting.row()
        if row["key"] not in known:
            fresh += 1
        con.execute(
            f"INSERT INTO postings({','.join(POSTING_COLUMNS)},first_fetched,last_fetched) "
            f"VALUES({','.join('?' * len(POSTING_COLUMNS))},date('now'),date('now')) "
            "ON CONFLICT(key) DO UPDATE SET "
            "  last_fetched=date('now'),"
            "  title=excluded.title, location=excluded.location, remote=excluded.remote,"
            "  sponsored=excluded.sponsored, expired=excluded.expired,"
            "  compensation=COALESCE(excluded.compensation, postings.compensation),"
            "  description=COALESCE(excluded.description, postings.description),"
            "  raw=COALESCE(excluded.raw, postings.raw)",
            tuple(row[c] for c in POSTING_COLUMNS))
    con.commit()
    return fresh


def _next_step(con):
    pending = con.execute("SELECT COUNT(*) n FROM postings WHERE disposition IS NULL").fetchone()["n"]
    print(f"\nnothing filtered yet — {pending} postings pending; run job-scan ingest to derive prospects")


@app.command("sources")
def show_sources():
    """print the source registry: kind, rank, endpoint, quirks"""
    sources.describe()


@app.command()
def boards(company: list[str] = typer.Option(None, help="limit to these company names or slugs"),
           workers: int = 8, db: str = None):
    """fetch every active board source over HTTP"""
    con = jobkit.connect(db)
    companies = [dict(r) for r in con.execute(
        "SELECT name, ats, slug FROM companies WHERE active=1 ORDER BY name").fetchall()
        if r["ats"] in sources.BOARDS]
    if company:
        wanted = {w.lower() for w in company}
        companies = [c for c in companies if c["name"].lower() in wanted or c["slug"].lower() in wanted]
    if not companies:
        print("No active companies matched. Seed the database or add companies to it.", file=sys.stderr)
        raise typer.Exit(1)

    fetched, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(sources.BOARDS[c["ats"]], c): c for c in companies}
        for future in concurrent.futures.as_completed(futures):
            board = futures[future]
            try:
                fetched.extend(future.result())
            except Exception as error:
                failures.append((board["name"], f"{type(error).__name__}: {error}"))

    new = store(con, fetched)
    print(f"FETCHED {len(fetched)} postings from {len(companies)} boards ({new} new)")
    if failures:
        print("\nboards that failed (likely a wrong slug or a board that moved ATS):")
        for name, err in failures:
            print(f"  - {name}: {err}")
    _next_step(con)


@app.command()
def harvest(source: str = typer.Option(...), file: str = typer.Option(...), db: str = None):
    """load a browser harvest into the raw layer"""
    entry = sources.REGISTRY.get(source)
    if not entry or entry["kind"] != "harvest":
        harvests = [n for n, s in sources.REGISTRY.items() if s["kind"] == "harvest"]
        print(f"unknown harvest source '{source}'. known: {', '.join(harvests)}", file=sys.stderr)
        raise typer.Exit(1)
    con = jobkit.connect(db)
    postings = entry["fetch"](file)
    new = store(con, postings)
    print(f"FETCHED {len(postings)} {source} postings ({new} new)")
    _next_step(con)


@app.command()
def descriptions(file: str = typer.Option(...),
                 source: str = typer.Option("indeed", help="prefix for bare ids in the file"),
                 db: str = None):
    """attach descriptions fetched for kept postings"""
    con = jobkit.connect(db)
    with open(file, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    items = payload if isinstance(payload, list) else payload.get("descriptions", [])

    filled = missing = 0
    for item in items:
        key = item.get("key") or item.get("jobkey")
        if not key:
            continue
        if ":" not in str(key):
            key = f"{source}:{key}"
        text = (item.get("description") or "")[:MAX_DESCRIPTION_CHARS]
        if not text:
            missing += 1
            continue
        filled += con.execute(
            "UPDATE postings SET description=?,"
            "  last_seen=CASE WHEN disposition='kept' THEN date('now') ELSE last_seen END"
            " WHERE key=?", (text, key)).rowcount
    con.commit()

    empty = con.execute(
        "SELECT COUNT(*) n FROM postings WHERE disposition='kept'"
        " AND (description IS NULL OR description='')").fetchone()["n"]
    print(f"attached {filled} descriptions")
    if missing:
        print(f"{missing} entries carried no description text")
    if empty:
        print(f"warning: {empty} prospects still have none")


DISPOSITIONS = {
    "sponsored": "paid placements -- almost entirely gig spam and unrelated listings",
    "expired":   "dead listings still in an index, including an unlisted Ashby posting",
    "agency":    "reposters and body shops, by `agency_blocklist` name or `agency_name_patterns`",
    "noise":     "`title_noise` -- AI Trainer, annotation, tutoring, freelance-gig phrasing",
    "lowball":   "a STATED YEARLY band topping out below `comp_floor`; per-hour or unstated is not judged",
    "title":     "fails `title_include`, or matches `title_exclude`",
    "location":  "fails `location_include`, or matches `location_exclude` with no US anchor; remote skips the include test",
    "stale":     "older than `max_age_days`",
    "covered":   "a better-ranked source already covers this company",
    "seen":      "already kept, or already collapsed into a kept row, by key or company + title",
    "duplicate": "one role listed in several places, collapsed into the row that was kept",
    "upgraded":  "NOT A DROP: a better-ranked source replaced the source on an existing prospect",
}

assert set(DISPOSITIONS) | {"kept"} == jobkit.vocabulary("postings", "disposition"), (
    "DISPOSITIONS and the schema disagree: "
    f"{sorted(set(DISPOSITIONS) ^ (jobkit.vocabulary('postings', 'disposition') - {'kept'}))}")


@app.command()
def dispositions():
    """every verdict, in the order the chain rules"""
    print("Every verdict a posting can get, in the order the chain rules.\n"
          "Each filter applies to every source.\n")
    width = max(len(name) for name in DISPOSITIONS)
    for name, note in DISPOSITIONS.items():
        print(f"  {name:<{width}}  {note}")
    print("\n  kept" + " " * (width - 4) + "  NOT A DROP: promoted to prospects")
    print("\nEvery posting keeps its ruling in `postings.disposition`, so what a filter cost")
    print("stays queryable after the run. Patterns live in the `filters` table.")


CARRIED = ("first_seen", "score", "reason", "resume", "status")
MERGED = ("description", "compensation")

PATTERN_KINDS = ("title_include", "title_exclude", "location_include", "location_exclude",
                 "us_tokens", "title_noise", "agency_name_patterns")


def load_config(con, options):
    settings = {r["key"]: r["value"] for r in con.execute("SELECT key,value FROM settings").fetchall()}

    def patterns(kind):
        return compile_patterns([r["pattern"] for r in con.execute(
            "SELECT pattern FROM filters WHERE kind=?", (kind,)).fetchall()])

    return {
        **options,
        **{kind: patterns(kind) for kind in PATTERN_KINDS},
        "agency_blocklist": {norm_company(r["pattern"]) for r in con.execute(
            "SELECT pattern FROM filters WHERE kind='agency_blocklist'").fetchall()},
        "max_age_days": options["max_age_days"] if options["max_age_days"] is not None
                        else int(settings.get("max_age_days", 30)),
        "comp_floor": options["comp_floor"] if options["comp_floor"] is not None
                      else int(settings.get("comp_floor", 0)),
    }


def below_comp_floor(row: Posting, floor) -> bool:
    if not floor or row.comp_period != "YEARLY":
        return False
    top = row.comp_max or row.comp_min
    return bool(top) and top < floor


def verdict(row, config, seen_keys, held, covered):
    title, location, company = row.title, row.location or "", row.company

    if row.sponsored:
        return "sponsored", None
    if row.expired:
        return "expired", None
    if norm_company(company) in config["agency_blocklist"] or \
       matches_any(config["agency_name_patterns"], company):
        return "agency", None
    if matches_any(config["title_noise"], title):
        return "noise", None
    if below_comp_floor(row, config["comp_floor"]):
        return "lowball", None

    if config["title_include"] and not matches_any(config["title_include"], title):
        return "title", None
    if matches_any(config["title_exclude"], title):
        return "title", None

    if config["location_filter"]:
        anchored = matches_any(config["us_tokens"], location) or location.strip().lower() == "remote"
        if config["location_exclude"] and not anchored and matches_any(config["location_exclude"], location):
            return "location", None
        if config["location_include"] and not row.remote and \
           not matches_any(config["location_include"], location):
            return "location", None

    days = age_days(row.posted_at)
    if config["max_age_days"] and days is not None and days > config["max_age_days"]:
        return "stale", None

    if not config["keep_covered"] and covered.get(norm_company(company), 99) < sources.rank(row.source):
        return "covered", None

    if not config["include_seen"]:
        if row.key in seen_keys:
            return "seen", None
        holder = held.get((norm_company(company), norm(title)))
        if holder:
            if sources.rank(row.source) < holder["rank"] and \
               holder["status"] in ("new", "scored"):
                return "upgraded", holder["key"]
            return "seen", holder["key"]
    return None, None


def collapse(rows, pinned):
    grouped = {}
    for row in rows:
        group = (norm_company(row.company), norm(row.title))
        grouped.setdefault(group, []).append(row)

    kept, dupes = [], []
    for group in grouped.values():
        group.sort(key=lambda r: (r.key not in pinned, sources.rank(r.source),
                                  not r.remote, r.key))
        primary, siblings = group[0], [r.key for r in group[1:]]
        dupes.extend(group[1:])
        kept.append((primary, siblings))
    return kept, dupes


def promote(con, old_key, new_key):
    old = con.execute("SELECT * FROM postings WHERE key=?", (old_key,)).fetchone()
    con.execute(
        "UPDATE postings SET disposition='kept', canonical_key=NULL, ingested_on=date('now'),"
        "  last_seen=date('now'), " + ", ".join(f"{c}=?" for c in CARRIED) + ", "
        + ", ".join(f"{c}=COALESCE({c},?)" for c in MERGED) + " WHERE key=?",
        tuple(old[c] for c in CARRIED + MERGED) + (new_key,))
    con.execute(
        "UPDATE postings SET disposition='upgraded', canonical_key=?, ingested_on=date('now'),"
        "  last_seen=NULL, "
        + ", ".join(f"{c}=NULL" for c in CARRIED) + " WHERE key=?", (new_key, old_key))
    for table in ("events", "staged", "staged_fields"):
        con.execute(f"UPDATE {table} SET key=? WHERE key=?", (new_key, old_key))
    con.execute("UPDATE postings SET canonical_key=? WHERE canonical_key=?", (new_key, old_key))


@app.command()
def ingest(redo: bool = typer.Option(
               False, "--redo",
               help="rule again on postings already dispositioned, without re-fetching"),
           source: list[str] = typer.Option(None, help="limit to these sources"),
           include_seen: bool = typer.Option(False, "--include-seen",
                                             help="ignore what is already in prospects"),
           keep_covered: bool = typer.Option(
               False, "--keep-covered",
               help="keep postings whose company a higher-precedence source already covers"),
           location_filter: bool = typer.Option(
               True, "--location-filter/--no-location-filter",
               help="see what the location rule is costing"),
           max_age_days: int = typer.Option(None, help="override the stored age limit for one run"),
           comp_floor: int = typer.Option(
               None, help="override the stored compensation floor for one run"),
           db: str = None):
    """derive prospects from the raw layer; fetches nothing"""
    con = jobkit.connect(db)
    config = load_config(con, {
        "include_seen": include_seen, "keep_covered": keep_covered,
        "location_filter": location_filter, "max_age_days": max_age_days,
        "comp_floor": comp_floor})

    where = "WHERE disposition IS NOT 'kept'" if redo else "WHERE disposition IS NULL"
    rows = [Posting(**{c: r[c] for c in POSTING_COLUMNS})
            for r in con.execute(f"SELECT {','.join(POSTING_COLUMNS)} FROM postings {where}").fetchall()]
    if source:
        wanted = {s.lower() for s in source}
        rows = [r for r in rows if r.source.lower() in wanted]
    if not rows:
        print("nothing pending in postings — fetch first, or pass --redo")
        return 0

    live = con.execute(
        "SELECT key, company, title, source, status FROM postings WHERE disposition='kept'").fetchall()
    pinned = {r["key"] for r in live}
    seen_keys = set() if include_seen else pinned | {
        r["key"] for r in con.execute(
            "SELECT key FROM postings WHERE canonical_key IS NOT NULL").fetchall()}
    held = {} if include_seen else {
        (norm_company(r["company"]), norm(r["title"])): {
            "key": r["key"], "status": r["status"], "rank": sources.rank(r["source"])}
        for r in live}
    covered = {norm_company(r["name"]): sources.rank(r["ats"]) for r in
               con.execute("SELECT name, ats FROM companies WHERE active=1").fetchall()
               if r["ats"] in sources.REGISTRY}

    counts = {name: 0 for name in DISPOSITIONS}
    survivors, dispositions, upgrades = [], [], []
    for row in sorted(rows, key=lambda r: sources.rank(r.source)):
        ruling, target = verdict(row, config, seen_keys, held, covered)
        pair = (norm_company(row.company), norm(row.title))
        if ruling == "upgraded":
            upgrades.append((row, target))
            counts["upgraded"] += 1
            held[pair] = {"key": row.key, "status": "new",
                          "rank": sources.rank(row.source)}
        elif ruling:
            counts[ruling] += 1
            dispositions.append((ruling, target if target != row.key else None, row.key))
        else:
            survivors.append(row)

    survivors, dupes = collapse(survivors, pinned)
    counts["duplicate"] += len(dupes)

    for row, siblings in survivors:
        dispositions.append(("kept", None, row.key))
        dispositions.extend(("duplicate", row.key, alias) for alias in siblings)

    con.executemany(
        "UPDATE postings SET disposition=?, canonical_key=COALESCE(?, canonical_key),"
        "  ingested_on=date('now') WHERE key=?",
        dispositions)

    for row, target in upgrades:
        promote(con, target, row.key)

    con.commit()

    print(f"NEW PROSPECTS: {len(survivors)}   (from {len(rows)} postings)")
    if upgrades:
        print(f"upgraded {len(upgrades)} to a better-ranked source")
    dropped = {name: n for name, n in counts.items() if n and name != "upgraded"}
    if dropped:
        print("dropped: " + " | ".join(f"{name} {n}" for name, n in dropped.items()))

    unknown = con.execute(
        "SELECT company, COUNT(*) n FROM postings WHERE disposition='kept' "
        "AND ingested_on=date('now') AND lower(company) NOT IN "
        "(SELECT lower(name) FROM companies) GROUP BY company ORDER BY n DESC").fetchall()
    if unknown:
        print("\ncompanies not on the watchlist:")
        for row in unknown:
            print(f"  {row['n']:2}  {row['company']}")
    pending = con.execute("SELECT COUNT(*) n FROM postings WHERE disposition IS NULL").fetchone()["n"]
    if pending:
        print(f"\n{pending} postings still pending")


if __name__ == "__main__":
    app()
