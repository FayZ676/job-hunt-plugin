#!/usr/bin/env python3
"""Filter and merge Indeed search results into the day's candidate list.

Two passes, because the browser does the fetching and this does the judging:

  filter  raw search cards -> survivors that deserve a full job description
  merge   survivors + fetched descriptions -> career/jobs/<date>-candidates.json
"""

import argparse
import datetime as dt
import json
import os
import sys

from jobkit import (
    MAX_DESCRIPTION_CHARS,
    age_days,
    compile_patterns,
    iter_ledger,
    matches_any,
    norm,
    norm_company,
    to_iso,
)

VIEWJOB = "https://www.indeed.com/viewjob?jk={}"
APPLYSTART = "https://www.indeed.com/applystart?jk={}&from=vj"


def load_ledger_keys(path):
    keys, pairs = set(), set()
    for entry in iter_ledger(path):
        if entry.get("key"):
            keys.add(entry["key"])
        keys.update(entry.get("duplicate_keys") or [])
        if entry.get("company") and entry.get("title"):
            pairs.add((norm_company(entry["company"]), norm(entry["title"])))
    return keys, pairs


def load_tracked_companies(path):
    if not os.path.exists(path):
        return set()
    with open(path, "r", encoding="utf-8") as handle:
        config = json.load(handle)
    return {
        norm_company(c["name"])
        for c in config.get("companies", [])
        if c.get("active", True)
    }


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

    with open(args.queries, "r", encoding="utf-8") as handle:
        qconf = json.load(handle)
    with open(args.config, "r", encoding="utf-8") as handle:
        sconf = json.load(handle)

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
        ledger_keys, ledger_pairs = load_ledger_keys(args.ledger)
    tracked = set() if args.keep_tracked else load_tracked_companies(args.config)

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

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "indeed",
        "counts": counts,
        "candidates": records,
    }
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    print(f"indeed cards: {counts['fetched']}")
    print(
        "dropped: sponsored {sponsored} | agency {agency} | noise {noise} | lowball {lowball} | title {title} | "
        "location {location} | stale {stale} | expired {expired} | already-seen {seen} | "
        "already-tracked {tracked} | dupes {duplicate}".format(**counts)
    )
    print(f"NEEDS DESCRIPTION: {len(records)} -> {args.out}")
    if discovered:
        print("\ncompanies not on the automated watchlist:")
        for name, n in sorted(discovered.items(), key=lambda kv: -kv[1]):
            print(f"  {n:2}  {name}")
    return 0


def cmd_merge(args):
    with open(args.pending, "r", encoding="utf-8") as handle:
        pending = json.load(handle)
    records = pending["candidates"]

    descriptions = {}
    if args.descriptions and os.path.exists(args.descriptions):
        with open(args.descriptions, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        for item in payload if isinstance(payload, list) else payload.get("descriptions", []):
            jobkey = item.get("jobkey") or item.get("jk")
            if jobkey:
                descriptions[f"indeed:{jobkey}"] = item

    kept = []
    missing = 0
    for record in records:
        detail = descriptions.get(record["key"])
        if detail:
            record["description"] = (detail.get("description") or "")[:MAX_DESCRIPTION_CHARS]
            if detail.get("resolved_url"):
                record["resolved_ats_url"] = detail["resolved_url"]
            if detail.get("compensation") and not record.get("compensation"):
                record["compensation"] = detail["compensation"]
        if not record["description"]:
            missing += 1
            if args.require_description:
                continue
        kept.append(record)

    target = args.out or os.path.join(
        "career", "jobs", f"{dt.date.today().isoformat()}-candidates.json"
    )

    if os.path.exists(target):
        with open(target, "r", encoding="utf-8") as handle:
            existing = json.load(handle)
    else:
        existing = {
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "counts": {},
            "candidates": [],
        }

    have = {c.get("key") for c in existing.get("candidates", [])}
    have_pairs = {
        (norm_company(c.get("company")), norm(c.get("title")))
        for c in existing.get("candidates", [])
    }

    added, collided = 0, 0
    for record in kept:
        if record["key"] in have:
            continue
        if (norm_company(record["company"]), norm(record["title"])) in have_pairs:
            collided += 1
            continue
        existing.setdefault("candidates", []).append(record)
        added += 1

    existing.setdefault("counts", {})["indeed"] = pending.get("counts", {})
    existing["counts"]["indeed_added"] = added

    with open(target, "w", encoding="utf-8") as handle:
        json.dump(existing, handle, indent=2)

    print(f"merged {added} indeed candidates into {target}")
    if collided:
        print(f"skipped {collided} already present from an ATS board this run")
    if missing:
        print(f"warning: {missing} records still have no description")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    today = dt.date.today().isoformat()

    f = sub.add_parser("filter", help="raw search cards -> survivors needing descriptions")
    f.add_argument("--raw", required=True)
    f.add_argument("--out", default=os.path.join("career", "jobs", f"{today}-indeed-pending.json"))
    f.add_argument("--queries", default=os.path.join("career", "indeed-queries.json"))
    f.add_argument("--config", default=os.path.join("career", "scan-config.json"))
    f.add_argument("--ledger", default=os.path.join("career", "applications.jsonl"))
    f.add_argument("--max-age-days", type=int, default=None)
    f.add_argument("--comp-floor", type=int, default=None, help="drop yearly bands topping out below this")
    f.add_argument("--include-seen", action="store_true")
    f.add_argument("--keep-tracked", action="store_true", help="keep roles at companies scan.py already covers")
    f.add_argument("--no-location-filter", action="store_true")
    f.set_defaults(func=cmd_filter)

    m = sub.add_parser("merge", help="survivors + descriptions -> the day's candidates file")
    m.add_argument("--pending", default=os.path.join("career", "jobs", f"{today}-indeed-pending.json"))
    m.add_argument("--descriptions", default=None)
    m.add_argument("--out", default=None)
    m.add_argument("--require-description", action="store_true")
    m.set_defaults(func=cmd_merge)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
