#!/usr/bin/env python3
"""Filter and merge Indeed search results into the day's candidate list.

Two passes, because the browser does the fetching and this does the judging:

  filter  raw search cards -> survivors that deserve a full job description
  merge   survivors + fetched descriptions -> the day's scan index
"""

import argparse
import datetime as dt
import json
import sys

import db as jobdb
import jobkit
from jobkit import (
    MAX_DESCRIPTION_CHARS,
    age_days,
    compile_patterns,
    matches_any,
    norm,
    norm_company,
    to_iso,
)

VIEWJOB = "https://www.indeed.com/viewjob?jk={}"
APPLYSTART = "https://www.indeed.com/applystart?jk={}&from=vj"





def compensation(card):
    extracted = card.get("extractedSalary") or {}
    if extracted.get("min") or extracted.get("max"):
        unit = (extracted.get("type") or "").lower()
        low, high = extracted.get("min"), extracted.get("max")
        if low and high:
            return f"{low:,.0f}-{high:,.0f} {unit}".strip()
        return f"{(low or high):,.0f} {unit}".strip()
    snippet = card.get("salarySnippet") or {}
    return (snippet.get("text") or "").strip() or None


def below_comp_floor(card, floor):
    if not floor:
        return False
    extracted = card.get("extractedSalary") or {}
    if (extracted.get("type") or "").upper() != "YEARLY":
        return False
    top = extracted.get("max") or extracted.get("min")
    return bool(top) and top < floor


def to_record(card):
    jobkey = card.get("jobkey")
    location = (card.get("formattedLocation") or "").strip()
    remote_model = card.get("remoteWorkModel") or {}
    remote = bool(remote_model.get("type")) or "remote" in location.lower()
    posted_at = to_iso(card.get("pubDate") or card.get("createDate"))
    return {
        "key": f"indeed:{jobkey}",
        "source": "indeed",
        "company": (card.get("company") or "").strip(),
        "title": (card.get("title") or card.get("displayTitle") or "").strip(),
        "location": location,
        "remote": remote,
        "url": VIEWJOB.format(jobkey),
        "apply_url": APPLYSTART.format(jobkey),
        "posted_at": posted_at,
        "age_days": age_days(posted_at),
        "compensation": compensation(card),
        "description": "",
        "indeed_apply": bool(card.get("indeedApplyEnabled")),
        "indeed_query": card.get("_query"),
        "resolved_ats_url": None,
    }


def flatten(raw):
    if isinstance(raw, list):
        return raw
    cards = []
    for block in raw.get("results", []):
        if isinstance(block, dict) and "rows" in block:
            for row in block["rows"]:
                row.setdefault("_query", block.get("query"))
                cards.append(row)
        else:
            cards.append(block)
    return cards


def cmd_filter(args):
    with open(args.raw, "r", encoding="utf-8") as handle:
        cards = flatten(json.load(handle))

    con = jobdb.connect(args.db)
    settings = {r["key"]: r["value"] for r in con.execute("SELECT key,value FROM settings").fetchall()}
    def patterns(kind):
        return [r["pattern"] for r in con.execute(
            "SELECT pattern FROM filters WHERE kind=?", (kind,)).fetchall()]
    qconf = {
        "comp_floor": int(settings.get("comp_floor", 0)),
        "fromage_days": int(settings.get("fromage_days", 7)),
        "title_noise": patterns("title_noise"),
        "agency_name_patterns": patterns("agency_name_patterns"),
        "agency_blocklist": patterns("agency_blocklist"),
    }
    sconf = {k: patterns(k) for k in
             ("title_include", "title_exclude", "location_include", "location_exclude", "us_tokens")}
    sconf["max_age_days"] = int(settings.get("max_age_days", 30))

    title_include = compile_patterns(sconf.get("title_include"))
    title_exclude = compile_patterns(sconf.get("title_exclude"))
    location_include = compile_patterns(sconf.get("location_include"))
    location_exclude = compile_patterns(sconf.get("location_exclude"))
    us_tokens = compile_patterns(sconf.get("us_tokens"))
    title_noise = compile_patterns(qconf.get("title_noise"))
    agency_patterns = compile_patterns(qconf.get("agency_name_patterns"))
    blocked = {norm_company(n) for n in qconf.get("agency_blocklist", [])}
    max_age = args.max_age_days or sconf.get("max_age_days")
    comp_floor = args.comp_floor if args.comp_floor is not None else qconf.get("comp_floor")

    if args.include_seen:
        ledger_keys, ledger_pairs = set(), set()
    else:
        ledger_keys = {r["key"] for r in con.execute(
            "SELECT key FROM prospects UNION SELECT alias_key AS key FROM aliases").fetchall()}
        ledger_pairs = {(norm_company(r["company"]), norm(r["title"])) for r in
                        con.execute("SELECT company,title FROM prospects").fetchall()}
    tracked = set() if args.keep_tracked else {
        norm_company(r["name"]) for r in
        con.execute("SELECT name FROM companies WHERE active=1").fetchall()}

    counts = {
        "fetched": len(cards),
        "sponsored": 0,
        "agency": 0,
        "noise": 0,
        "lowball": 0,
        "title": 0,
        "location": 0,
        "stale": 0,
        "expired": 0,
        "seen": 0,
        "tracked": 0,
        "duplicate": 0,
    }
    survivors = {}
    pair_index = {}
    discovered = {}

    for card in cards:
        if not card.get("jobkey"):
            continue
        if card.get("sponsored"):
            counts["sponsored"] += 1
            continue
        if card.get("expired"):
            counts["expired"] += 1
            continue

        record = to_record(card)
        company_key = norm_company(record["company"])
        title = record["title"]

        if company_key in blocked or matches_any(agency_patterns, record["company"]):
            counts["agency"] += 1
            continue
        if matches_any(title_noise, title):
            counts["noise"] += 1
            continue
        if below_comp_floor(card, comp_floor):
            counts["lowball"] += 1
            continue
        if title_include and not matches_any(title_include, title):
            counts["title"] += 1
            continue
        if title_exclude and matches_any(title_exclude, title):
            counts["title"] += 1
            continue

        if not args.no_location_filter:
            location = record["location"]
            has_us_anchor = (
                matches_any(us_tokens, location) or location.strip().lower() == "remote"
            )
            if location_exclude and not has_us_anchor and matches_any(location_exclude, location):
                counts["location"] += 1
                continue
            if location_include and not record["remote"] and not matches_any(location_include, location):
                counts["location"] += 1
                continue

        if max_age and record["age_days"] is not None and record["age_days"] > max_age:
            counts["stale"] += 1
            continue
        if record["key"] in ledger_keys:
            counts["seen"] += 1
            continue

        pair = (company_key, norm(title))
        if pair in ledger_pairs:
            counts["seen"] += 1
            continue
        if company_key in tracked:
            counts["tracked"] += 1
            continue
        if record["key"] in survivors:
            counts["duplicate"] += 1
            continue
        if pair in pair_index:
            counts["duplicate"] += 1
            survivors[pair_index[pair]].setdefault("duplicate_keys", []).append(record["key"])
            continue

        survivors[record["key"]] = record
        pair_index[pair] = record["key"]
        discovered.setdefault(record["company"], 0)
        discovered[record["company"]] += 1

    records = sorted(
        survivors.values(),
        key=lambda r: (r["age_days"] if r["age_days"] is not None else 9999, r["company"]),
    )

    con = jobdb.connect(args.db)
    for record in records:
        con.execute(
            "INSERT OR IGNORE INTO prospects(key,company,title,url,apply_url,location,remote,"
            "compensation,posted_at,first_seen,last_seen,source,status) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,'indeed','new')",
            (record["key"], record["company"], record["title"], record.get("url"),
             record.get("apply_url"), record.get("location"), int(bool(record.get("remote"))),
             record.get("compensation"), record.get("posted_at"), jobkit.today(), jobkit.today()))
        con.execute("INSERT INTO events(key,at,status,note) VALUES(?,?,'new','indeed')",
                    (record["key"], jobdb.now()))
    con.commit()

    print(f"indeed cards: {counts['fetched']}")
    print(
        "dropped: sponsored {sponsored} | agency {agency} | noise {noise} | lowball {lowball} | title {title} | "
        "location {location} | stale {stale} | expired {expired} | already-seen {seen} | "
        "already-tracked {tracked} | dupes {duplicate}".format(**counts)
    )
    print(f"NEEDS DESCRIPTION: {len(records)}  (db.py list --new --json to fetch them)")
    if discovered:
        print("\ncompanies not on the automated watchlist:")
        for name, n in sorted(discovered.items(), key=lambda kv: -kv[1]):
            print(f"  {n:2}  {name}")
    return 0


def cmd_merge(args):
    """Attach fetched descriptions to prospects the filter pass already stored."""
    con = jobdb.connect(args.db)
    with open(args.descriptions, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    items = payload if isinstance(payload, list) else payload.get("descriptions", [])

    filled = missing = 0
    for item in items:
        jobkey = item.get("jobkey") or item.get("key")
        if not jobkey:
            continue
        key = jobkey if str(jobkey).startswith("indeed:") else f"indeed:{jobkey}"
        text = (item.get("description") or "")[:MAX_DESCRIPTION_CHARS]
        if not text:
            missing += 1
            continue
        filled += con.execute(
            "UPDATE prospects SET description=?, last_seen=? WHERE key=?",
            (text, jobkit.today(), key)).rowcount
    con.commit()

    empty = con.execute(
        "SELECT COUNT(*) n FROM prospects WHERE source='indeed' AND "
        "(description IS NULL OR description='')").fetchone()["n"]
    print(f"attached {filled} descriptions")
    if missing:
        print(f"{missing} entries carried no description text")
    if empty:
        print(f"warning: {empty} indeed prospects still have none")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    today = dt.date.today().isoformat()

    f = sub.add_parser("filter", help="raw search cards -> survivors needing descriptions")
    f.add_argument("--raw", required=True)
    f.add_argument("--db", default=None)
    f.add_argument("--max-age-days", type=int, default=None)
    f.add_argument("--comp-floor", type=int, default=None, help="drop yearly bands topping out below this")
    f.add_argument("--include-seen", action="store_true")
    f.add_argument("--keep-tracked", action="store_true", help="keep roles at companies scan.py already covers")
    f.add_argument("--no-location-filter", action="store_true")
    f.set_defaults(func=cmd_filter)

    m = sub.add_parser("merge", help="survivors + descriptions -> the day's candidates file")
    m.add_argument("--descriptions", default=None)
    m.add_argument("--db", default=None)
    m.set_defaults(func=cmd_merge)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
