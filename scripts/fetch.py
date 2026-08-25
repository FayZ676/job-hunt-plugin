"""Fetch postings into the raw layer. Judges nothing.

Every source lands in `postings` normalized but unfiltered: no scoring, no rows
in `prospects`. That separation is what lets `ingest.py` re-run a changed filter
over this morning's fetch without going back to the network.

  fetch.py boards                          every active board, in parallel
  fetch.py boards --company Anthropic      one board, for testing a new slug
  fetch.py harvest --source indeed --file harvest.json
  fetch.py descriptions --file descs.json  descriptions fetched for kept rows

Subcommands follow the mechanism, not the site: `boards` covers every source
that answers an HTTP request, `harvest` every source a browser had to collect.
Adding either kind is one line in `sources.REGISTRY`.
"""

import argparse
import concurrent.futures
import json
import sys

import jobkit
import sources
from jobkit import MAX_DESCRIPTION_CHARS
from models import Posting

COLUMNS = tuple(Posting.model_fields)


def store(con, postings):
    known = {r["key"] for r in con.execute("SELECT key FROM postings").fetchall()}
    fresh = 0
    for posting in postings:
        row = posting.row()
        if row["key"] not in known:
            fresh += 1
        con.execute(
            f"INSERT INTO postings({','.join(COLUMNS)},first_fetched,last_fetched) "
            f"VALUES({','.join('?' * len(COLUMNS))},date('now'),date('now')) "
            "ON CONFLICT(key) DO UPDATE SET "
            "  last_fetched=date('now'),"
            "  title=excluded.title, location=excluded.location, remote=excluded.remote,"
            "  sponsored=excluded.sponsored, expired=excluded.expired,"
            "  compensation=COALESCE(excluded.compensation, postings.compensation),"
            "  description=COALESCE(excluded.description, postings.description),"
            "  raw=COALESCE(excluded.raw, postings.raw)",
            tuple(row[c] for c in COLUMNS))
    con.commit()
    return fresh


def _next_step(con):
    pending = con.execute("SELECT COUNT(*) n FROM postings WHERE disposition IS NULL").fetchone()["n"]
    print(f"\nnothing filtered yet — {pending} postings pending; run ingest.py to derive prospects")


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
        con.execute("UPDATE postings SET description=? WHERE key=?", (text, key))
        filled += con.execute(
            "UPDATE prospects SET description=?, last_seen=date('now') WHERE key=?",
            (text, key)).rowcount
    con.commit()

    empty = con.execute(
        "SELECT COUNT(*) n FROM prospects WHERE description IS NULL OR description=''").fetchone()["n"]
    print(f"attached {filled} descriptions")
    if missing:
        print(f"{missing} entries carried no description text")
    if empty:
        print(f"warning: {empty} prospects still have none")
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

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
