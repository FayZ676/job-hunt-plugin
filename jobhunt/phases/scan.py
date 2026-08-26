"""Phase 1 — fetch postings, then rule on them. Two steps, and they stay separate.

  scan.py sources                          the registry: kind, rank, endpoint
  scan.py boards                           every active board, in parallel
  scan.py boards --company Anthropic       one board, for testing a new slug
  scan.py harvest --source indeed --file harvest.json
  scan.py descriptions --file descs.json   descriptions for rows ingest kept
  scan.py ingest                           postings -> prospects, no network
  scan.py ingest --redo --no-location-filter
  scan.py dispositions                     every verdict, in the order ruled
"""

import argparse
import concurrent.futures
import json
import sys

from jobhunt import jobkit, models, sources
from jobhunt.jobkit import MAX_DESCRIPTION_CHARS, age_days, compile_patterns, matches_any, norm, norm_company
from jobhunt.models import Posting

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
    print(f"\nnothing filtered yet — {pending} postings pending; run scan.py ingest to derive prospects")


def cmd_boards(args):
    con = jobkit.connect(args.db)
    companies = [dict(r) for r in con.execute(
        "SELECT name, ats, slug FROM companies WHERE active=1 ORDER BY name").fetchall()
        if r["ats"] in sources.BOARDS]
    if args.company:
        wanted = {w.lower() for w in args.company}
        companies = [c for c in companies if c["name"].lower() in wanted or c["slug"].lower() in wanted]
    if not companies:
        print("No active companies matched. Seed the database or add companies to it.", file=sys.stderr)
        return 1

    fetched, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(sources.BOARDS[c["ats"]], c): c for c in companies}
        for future in concurrent.futures.as_completed(futures):
            company = futures[future]
            try:
                fetched.extend(future.result())
            except Exception as error:
                failures.append((company["name"], f"{type(error).__name__}: {error}"))

    new = store(con, fetched)
    print(f"FETCHED {len(fetched)} postings from {len(companies)} boards ({new} new)")
    if failures:
        print("\nboards that failed (likely a wrong slug or a board that moved ATS):")
        for name, err in failures:
            print(f"  - {name}: {err}")
    _next_step(con)
    return 0


def cmd_harvest(args):
    source = sources.REGISTRY.get(args.source)
    if not source or source["kind"] != "harvest":
        harvests = [n for n, s in sources.REGISTRY.items() if s["kind"] == "harvest"]
        print(f"unknown harvest source '{args.source}'. known: {', '.join(harvests)}", file=sys.stderr)
        return 1
    con = jobkit.connect(args.db)
    postings = source["fetch"](args.file)
    new = store(con, postings)
    print(f"FETCHED {len(postings)} {args.source} postings ({new} new)")
    _next_step(con)
    return 0


def cmd_descriptions(args):
    con = jobkit.connect(args.db)
    with open(args.file, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    items = payload if isinstance(payload, list) else payload.get("descriptions", [])

    filled = missing = 0
    for item in items:
        key = item.get("key") or item.get("jobkey")
        if not key:
            continue
        if ":" not in str(key):
            key = f"{args.source}:{key}"
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
    return 0


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

assert set(DISPOSITIONS) == set(models.get_args(models.Disposition)) - {"kept"}, (
    "DISPOSITIONS and models.Disposition disagree: "
    f"{sorted(set(DISPOSITIONS) ^ (set(models.get_args(models.Disposition)) - {'kept'}))}")


def cmd_dispositions(_args):
    print("Every verdict a posting can get, in the order the chain rules.\n"
          "Each filter applies to every source.\n")
    width = max(len(name) for name in DISPOSITIONS)
    for name, note in DISPOSITIONS.items():
        print(f"  {name:<{width}}  {note}")
    print("\n  kept" + " " * (width - 4) + "  NOT A DROP: promoted to prospects")
    print("\nEvery posting keeps its ruling in `postings.disposition`, so what a filter cost")
    print("stays queryable after the run. Patterns live in the `filters` table.")
    return 0


PATTERN_KINDS = ("title_include", "title_exclude", "location_include", "location_exclude",
                 "us_tokens", "title_noise", "agency_name_patterns")


def load_config(con, args):
    settings = {r["key"]: r["value"] for r in con.execute("SELECT key,value FROM settings").fetchall()}

    def patterns(kind):
        return compile_patterns([r["pattern"] for r in con.execute(
            "SELECT pattern FROM filters WHERE kind=?", (kind,)).fetchall()])

    return {
        **{kind: patterns(kind) for kind in PATTERN_KINDS},
        "agency_blocklist": {norm_company(r["pattern"]) for r in con.execute(
            "SELECT pattern FROM filters WHERE kind='agency_blocklist'").fetchall()},
        "max_age_days": args.max_age_days if args.max_age_days is not None
                        else int(settings.get("max_age_days", 30)),
        "comp_floor": args.comp_floor if args.comp_floor is not None
                      else int(settings.get("comp_floor", 0)),
    }


def below_comp_floor(row: Posting, floor) -> bool:
    if not floor or row.comp_period != "YEARLY":
        return False
    top = row.comp_max or row.comp_min
    return bool(top) and top < floor


def verdict(row, config, args, seen_keys, held, covered):
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

    if not args.no_location_filter:
        anchored = matches_any(config["us_tokens"], location) or location.strip().lower() == "remote"
        if config["location_exclude"] and not anchored and matches_any(config["location_exclude"], location):
            return "location", None
        if config["location_include"] and not row.remote and \
           not matches_any(config["location_include"], location):
            return "location", None

    days = age_days(row.posted_at)
    if config["max_age_days"] and days is not None and days > config["max_age_days"]:
        return "stale", None

    if not args.keep_covered and covered.get(norm_company(company), 99) < sources.rank(row.source):
        return "covered", None

    if not args.include_seen:
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
    con.execute(
        "UPDATE postings SET disposition='kept', canonical_key=NULL, ingested_on=date('now'),"
        "  first_seen=(SELECT o.first_seen FROM postings o WHERE o.key=?),"
        "  last_seen=date('now'),"
        "  score=(SELECT o.score FROM postings o WHERE o.key=?),"
        "  reason=(SELECT o.reason FROM postings o WHERE o.key=?),"
        "  resume=(SELECT o.resume FROM postings o WHERE o.key=?),"
        "  status=(SELECT o.status FROM postings o WHERE o.key=?),"
        "  description=COALESCE(description, (SELECT o.description FROM postings o WHERE o.key=?)),"
        "  compensation=COALESCE(compensation, (SELECT o.compensation FROM postings o WHERE o.key=?))"
        " WHERE key=?",
        (old_key,) * 7 + (new_key,))

    con.execute(
        "UPDATE postings SET disposition='upgraded', canonical_key=?, ingested_on=date('now'),"
        "  first_seen=NULL, last_seen=NULL, score=NULL, reason=NULL, resume=NULL, status=NULL"
        " WHERE key=?", (new_key, old_key))

    for table in ("events", "staged", "staged_fields"):
        con.execute(f"UPDATE {table} SET key=? WHERE key=?", (new_key, old_key))
    con.execute("UPDATE postings SET canonical_key=? WHERE canonical_key=?", (new_key, old_key))


def cmd_ingest(args):
    con = jobkit.connect(args.db)
    config = load_config(con, args)

    where = "WHERE disposition IS NOT 'kept'" if args.redo else "WHERE disposition IS NULL"
    rows = [Posting(**{c: r[c] for c in POSTING_COLUMNS})
            for r in con.execute(f"SELECT {','.join(POSTING_COLUMNS)} FROM postings {where}").fetchall()]
    if args.source:
        wanted = {s.lower() for s in args.source}
        rows = [r for r in rows if r.source.lower() in wanted]
    if not rows:
        print("nothing pending in postings — fetch first, or pass --redo")
        return 0

    live = con.execute(
        "SELECT key, company, title, source, status FROM postings WHERE disposition='kept'").fetchall()
    pinned = {r["key"] for r in live}
    seen_keys = set() if args.include_seen else pinned | {
        r["key"] for r in con.execute(
            "SELECT key FROM postings WHERE canonical_key IS NOT NULL").fetchall()}
    held = {} if args.include_seen else {
        (norm_company(r["company"]), norm(r["title"])): {
            "key": r["key"], "status": r["status"], "rank": sources.rank(r["source"])}
        for r in live}
    covered = {norm_company(r["name"]): sources.rank(r["ats"]) for r in
               con.execute("SELECT name, ats FROM companies WHERE active=1").fetchall()
               if r["ats"] in sources.REGISTRY}

    counts = {name: 0 for name in DISPOSITIONS}
    survivors, dispositions, upgrades = [], [], []
    for row in sorted(rows, key=lambda r: sources.rank(r.source)):
        ruling, target = verdict(row, config, args, seen_keys, held, covered)
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
    return 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    src = sub.add_parser("sources", help="print the source registry: kind, rank, endpoint, quirks")
    src.set_defaults(func=lambda _args: sources.describe())

    b = sub.add_parser("boards", help="fetch every active board source over HTTP")
    b.add_argument("--company", action="append", help="limit to these company names or slugs")
    b.add_argument("--workers", type=int, default=8)
    b.add_argument("--db", default=None)
    b.set_defaults(func=cmd_boards)

    h = sub.add_parser("harvest", help="load a browser harvest into the raw layer")
    h.add_argument("--source", required=True)
    h.add_argument("--file", required=True)
    h.add_argument("--db", default=None)
    h.set_defaults(func=cmd_harvest)

    d = sub.add_parser("descriptions", help="attach descriptions fetched for kept postings")
    d.add_argument("--file", required=True)
    d.add_argument("--source", default="indeed", help="prefix for bare ids in the file")
    d.add_argument("--db", default=None)
    d.set_defaults(func=cmd_descriptions)

    i = sub.add_parser("ingest", help="derive prospects from the raw layer; fetches nothing")
    i.add_argument("--redo", action="store_true",
                   help="rule again on postings already dispositioned, without re-fetching")
    i.add_argument("--source", action="append", help="limit to these sources")
    i.add_argument("--include-seen", action="store_true",
                   help="ignore what is already in prospects")
    i.add_argument("--keep-covered", action="store_true",
                   help="keep postings whose company a higher-precedence source already covers")
    i.add_argument("--no-location-filter", action="store_true",
                   help="see what the location rule is costing")
    i.add_argument("--max-age-days", type=int, default=None,
                   help="override the stored age limit for one run")
    i.add_argument("--comp-floor", type=int, default=None,
                   help="override the stored compensation floor for one run")
    i.add_argument("--db", default=None)
    i.set_defaults(func=cmd_ingest)

    v = sub.add_parser("dispositions", help="every verdict, in the order the chain rules")
    v.set_defaults(func=cmd_dispositions)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
