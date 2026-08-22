#!/usr/bin/env python3
"""Derive prospects from the raw layer. Fetches nothing.

Reads `postings`, rules on every row, and promotes survivors into `prospects`
as `new`. Every row gets a disposition -- 'kept', or the name of the filter
that dropped it -- so what a filter costs is a query rather than a number that
scrolled past:

  SELECT disposition, COUNT(*) FROM postings
  WHERE ingested_on=date('now') GROUP BY disposition;

Judgment is separate from fetching, so a changed filter re-runs over what is
already on disk:

  ingest.py --redo                        rule again on everything, no network
  ingest.py --redo --no-location-filter   what is the location rule costing?

**No filter names a source.** Sources normalize into the same columns, so one
chain serves all of them and a new mechanism inherits every filter for free. A
source that cannot state a fact leaves the default, and the filter reading it
simply never trips.
"""

import argparse
import re
import sys

import jobkit
import models
import sources
from jobkit import age_days, compile_patterns, matches_any, norm, norm_company
from models import Prospect, StoredPosting

FILTERS = tuple(d for d in models.get_args(models.Disposition) if d != "kept")


def load_config(con, args):
    settings = {r["key"]: r["value"] for r in con.execute("SELECT key,value FROM settings").fetchall()}

    def patterns(kind):
        return compile_patterns([r["pattern"] for r in con.execute(
            "SELECT pattern FROM filters WHERE kind=?", (kind,)).fetchall()])

    return {
        "title_include": patterns("title_include"),
        "title_exclude": patterns("title_exclude"),
        "location_include": patterns("location_include"),
        "location_exclude": patterns("location_exclude"),
        "us_tokens": patterns("us_tokens"),
        "title_noise": patterns("title_noise"),
        "agency_name_patterns": patterns("agency_name_patterns"),
        "agency_blocklist": {norm_company(r["pattern"]) for r in con.execute(
            "SELECT pattern FROM filters WHERE kind='agency_blocklist'").fetchall()},
        "max_age_days": args.max_age_days if args.max_age_days is not None
                        else int(settings.get("max_age_days", 30)),
        "comp_floor": args.comp_floor if args.comp_floor is not None
                      else int(settings.get("comp_floor", 0)),
    }


def below_comp_floor(row: StoredPosting, floor) -> bool:
    """Only a stated yearly band can be below a yearly floor. A source that
    states no band, or states one per hour, is not judged on compensation."""
    if not floor or row.comp_period != "YEARLY":
        return False
    top = row.comp_max or row.comp_min
    return bool(top) and top < floor


def verdict(row, config, args, seen_keys, held, covered):
    """The single place a posting is judged, for every source alike.

    Returns (disposition, target) -- target names the prospect an 'upgraded'
    ruling applies to, and is None otherwise."""
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

    # Source precedence: a company's own board outranks an aggregator that
    # re-lists it, with a better description and a real apply URL.
    if not args.keep_covered and covered.get(norm_company(company), 99) < sources.RANK.get(row.source, 0):
        return "covered", None

    if not args.include_seen:
        if row.key in seen_keys:
            return "seen", None
        holder = held.get((norm_company(company), norm(title)))
        if holder:
            # A better-ranked source for a role something lower already holds is
            # an upgrade, not a duplicate: the employer's own board carries a
            # real description and a real apply URL. Only before any application
            # work has started, so a staged or applied row is never disturbed.
            if sources.RANK.get(row.source, 99) < holder["rank"] and \
               holder["status"] in ("new", "scored"):
                return "upgraded", holder["key"]
            return "seen", holder["key"]
    return None, None


def collapse(rows):
    """One role listed in several locations becomes one prospect; the siblings
    become aliases so they never resurface as new."""
    grouped = {}
    for row in rows:
        group = (row.company.lower(), re.sub(r"\s+", " ", row.title).strip().lower())
        grouped.setdefault(group, []).append(row)

    kept, dupes = [], []
    for group in grouped.values():
        group.sort(key=lambda r: (sources.RANK.get(r.source, 99), not r.remote, r.key))
        primary = group[0]
        siblings = []
        if len(group) > 1:
            # Whole strings, not comma-split parts: splitting turns
            # "Boulder, CO" into "Boulder" and a "CO" that dedupes away.
            locations = list(dict.fromkeys(
                (row.location or "").strip() for row in group if (row.location or "").strip()))
            primary = primary.model_copy(update={
                "location": "; ".join(locations),
                "remote": any(r.remote for r in group)})
            siblings = [r.key for r in group[1:]]
            dupes.extend(group[1:])
        kept.append((primary, siblings))
    return kept, dupes


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--redo", action="store_true",
                        help="rule again on postings already dispositioned, without re-fetching")
    parser.add_argument("--source", action="append", help="limit to these sources")
    parser.add_argument("--include-seen", action="store_true")
    parser.add_argument("--keep-covered", action="store_true",
                        help="keep postings whose company a higher-precedence source already covers")
    parser.add_argument("--no-location-filter", action="store_true")
    parser.add_argument("--max-age-days", type=int, default=None)
    parser.add_argument("--comp-floor", type=int, default=None)
    parser.add_argument("--db", default=None)
    args = parser.parse_args()

    con = jobkit.connect(args.db)
    config = load_config(con, args)

    where = "" if args.redo else "WHERE disposition IS NULL"
    rows = [StoredPosting.from_row(r) for r in con.execute(f"SELECT * FROM postings {where}").fetchall()]
    if args.source:
        wanted = {s.lower() for s in args.source}
        rows = [r for r in rows if r.source.lower() in wanted]
    if not rows:
        print("nothing pending in postings — fetch first, or pass --redo")
        return 0

    seen_keys = set() if args.include_seen else {
        r["key"] for r in con.execute(
            "SELECT key FROM prospects UNION SELECT alias_key AS key FROM aliases").fetchall()}
    held = {} if args.include_seen else {
        (norm_company(r["company"]), norm(r["title"])): {
            "key": r["key"], "status": r["status"],
            "rank": sources.RANK.get(r["source"], 99)}
        for r in con.execute("SELECT key,company,title,source,status FROM prospects").fetchall()}
    covered = {norm_company(r["name"]): sources.RANK.get(r["ats"], 0) for r in
               con.execute("SELECT name, ats FROM companies WHERE active=1").fetchall()
               if r["ats"] in sources.REGISTRY}

    counts = {name: 0 for name in FILTERS}
    survivors, dispositions, upgrades, aliases = [], [], [], []
    for row in sorted(rows, key=lambda r: sources.RANK.get(r.source, 99)):
        ruling, target = verdict(row, config, args, seen_keys, held, covered)
        pair = (norm_company(row.company), norm(row.title))
        if ruling == "upgraded":
            upgrades.append((row, target))
            counts["upgraded"] += 1
            dispositions.append((ruling, row.key))
            held[pair] = {"key": target, "status": "new",
                          "rank": sources.RANK.get(row.source, 99)}
        elif ruling:
            counts[ruling] += 1
            dispositions.append((ruling, row.key))
            if ruling == "seen" and target and target != row.key:
                aliases.append((row.key, target))
        else:
            # No within-run pair bookkeeping here: collapse() owns same-run
            # collisions, and it merges their locations and picks the
            # better-ranked source instead of dropping the second one blind.
            survivors.append(row)

    survivors, dupes = collapse(survivors)
    counts["duplicate"] += len(dupes)
    dispositions.extend(("duplicate", row.key) for row in dupes)

    columns = ("key", "company", "title", "url", "apply_url", "location", "remote",
               "compensation", "posted_at", "source", "ats", "description", "status")
    for row, siblings in survivors:
        prospect = Prospect.from_posting(row).row()
        con.execute(
            f"INSERT OR IGNORE INTO prospects({','.join(columns)},first_seen,last_seen) "
            f"VALUES({','.join('?' * len(columns))},date('now'),date('now'))",
            tuple(prospect[c] for c in columns))
        for alias in siblings:
            con.execute("INSERT OR IGNORE INTO aliases(alias_key,key) VALUES(?,?)", (alias, row.key))
        dispositions.append(("kept", row.key))

    con.executemany("INSERT OR IGNORE INTO aliases(alias_key,key) VALUES(?,?)", aliases)

    for row, target in upgrades:
        con.execute(
            "UPDATE prospects SET url=?, apply_url=?, source=?, ats=?, last_seen=date('now'),"
            "  description=COALESCE(?, description),"
            "  compensation=COALESCE(?, compensation) WHERE key=?",
            (row.url, row.apply_url, row.source, row.ats,
             row.description, row.compensation, target))
        con.execute("INSERT OR IGNORE INTO aliases(alias_key,key) VALUES(?,?)", (row.key, target))

    con.executemany(
        "UPDATE postings SET disposition=?, ingested_on=date('now') WHERE key=?", dispositions)
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


if __name__ == "__main__":
    sys.exit(main())
