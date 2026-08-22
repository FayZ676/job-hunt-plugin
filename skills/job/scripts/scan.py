#!/usr/bin/env python3

import argparse
import concurrent.futures
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

import jobkit
from jobkit import (
    MAX_DESCRIPTION_CHARS,
    age_days,
    compile_patterns,
    iter_ledger,
    load_config,
    matches_any,
    to_iso,
    write_json,
)

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) job-scan/1.0"
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"[ \t\r\f\v]+")
BLANKS_RE = re.compile(r"\n{3,}")


def http_get_json(url, timeout=25, attempts=3):
    last_error = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8", "replace"))
        except Exception as error:
            last_error = error
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
    raise last_error


def html_to_text(raw):
    if not raw:
        return ""
    text = html.unescape(str(raw))
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|tr)>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "- ", text)
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = WS_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return BLANKS_RE.sub("\n\n", text).strip()



def fetch_greenhouse(company):
    slug = company["slug"]
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    payload = http_get_json(url)
    records = []
    for job in payload.get("jobs", []):
        location = (job.get("location") or {}).get("name") or ""
        records.append({
            "key": f"greenhouse:{slug}:{job.get('id')}",
            "source": "greenhouse",
            "company": company["name"],
            "title": (job.get("title") or "").strip(),
            "location": location.strip(),
            "remote": "remote" in location.lower(),
            "url": job.get("absolute_url"),
            "apply_url": job.get("absolute_url"),
            "posted_at": to_iso(job.get("first_published") or job.get("updated_at")),
            "compensation": None,
            "description": html_to_text(job.get("content"))[:MAX_DESCRIPTION_CHARS],
        })
    return records


def lever_description(job):
    parts = [job.get("descriptionPlain") or html_to_text(job.get("description"))]
    for section in job.get("lists") or []:
        heading = (section.get("text") or "").strip()
        body = html_to_text(section.get("content"))
        if heading:
            parts.append(heading)
        if body:
            parts.append(body)
    parts.append(job.get("additionalPlain") or html_to_text(job.get("additional")))
    return "\n\n".join(part for part in parts if part)[:MAX_DESCRIPTION_CHARS]


def fetch_lever(company):
    slug = company["slug"]
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    payload = http_get_json(url)
    if not isinstance(payload, list):
        raise ValueError("lever board returned no posting list")
    records = []
    for job in payload:
        categories = job.get("categories") or {}
        locations = categories.get("allLocations") or []
        location = categories.get("location") or (locations[0] if locations else "")
        workplace = (job.get("workplaceType") or "").lower()
        salary = job.get("salaryRange") or {}
        records.append({
            "key": f"lever:{slug}:{job.get('id')}",
            "source": "lever",
            "company": company["name"],
            "title": (job.get("text") or "").strip(),
            "location": ", ".join(locations) if locations else str(location).strip(),
            "remote": workplace == "remote" or "remote" in str(location).lower(),
            "url": job.get("hostedUrl"),
            "apply_url": job.get("applyUrl") or job.get("hostedUrl"),
            "posted_at": to_iso(job.get("createdAt")),
            "compensation": (
                f"{salary.get('min')}-{salary.get('max')} {salary.get('currency') or ''}".strip()
                if salary.get("min") else None
            ),
            "description": lever_description(job),
        })
    return records


def fetch_ashby(company):
    slug = company["slug"]
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true"
    payload = http_get_json(url)
    records = []
    for job in payload.get("jobs", []):
        if job.get("isListed") is False:
            continue
        secondary = job.get("secondaryLocations") or []
        extra = [s.get("location") for s in secondary if isinstance(s, dict) and s.get("location")]
        location = ", ".join([job.get("location") or ""] + extra).strip(", ")
        compensation = job.get("compensation") or {}
        summary = compensation.get("compensationTierSummary") if isinstance(compensation, dict) else None
        records.append({
            "key": f"ashby:{slug}:{job.get('id')}",
            "source": "ashby",
            "company": company["name"],
            "title": (job.get("title") or "").strip(),
            "location": location,
            "remote": bool(job.get("isRemote")) or "remote" in location.lower(),
            "url": job.get("jobUrl"),
            "apply_url": job.get("applyUrl") or job.get("jobUrl"),
            "posted_at": to_iso(job.get("publishedAt")),
            "compensation": summary,
            "description": (
                job.get("descriptionPlain")
                or html_to_text(job.get("descriptionHtml"))
            )[:MAX_DESCRIPTION_CHARS],
        })
    return records


FETCHERS = {"greenhouse": fetch_greenhouse, "lever": fetch_lever, "ashby": fetch_ashby}


def load_seen_keys(ledger_path):
    return {e["key"]: e for e in iter_ledger(ledger_path) if e.get("key")}


def collapse_duplicates(records):
    grouped = {}
    for record in records:
        group_key = (record["company"].lower(), re.sub(r"\s+", " ", record["title"]).strip().lower())
        grouped.setdefault(group_key, []).append(record)

    collapsed = []
    for group in grouped.values():
        group.sort(key=lambda r: (not r["remote"], r["key"]))
        primary = dict(group[0])
        if len(group) > 1:
            locations = []
            for record in group:
                for part in record["location"].split(","):
                    part = part.strip()
                    if part and part not in locations:
                        locations.append(part)
            primary["location"] = ", ".join(locations)
            primary["remote"] = any(r["remote"] for r in group)
            primary["duplicate_keys"] = [r["key"] for r in group[1:]]
        collapsed.append(primary)
    return collapsed


def main():
    parser = argparse.ArgumentParser(description="Fetch and filter ATS job boards into a candidate list.")
    parser.add_argument("--config", default=jobkit.WATCHLIST)
    parser.add_argument("--ledger", default=jobkit.LEDGER)
    parser.add_argument("--out", default=None, help=f"index path; default {jobkit.scan_index()}")
    parser.add_argument("--company", action="append", help="limit run to these company names or slugs")
    parser.add_argument("--max-age-days", type=int, default=None)
    parser.add_argument("--include-seen", action="store_true", help="do not filter out keys already in the ledger")
    parser.add_argument("--no-location-filter", action="store_true")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--force", action="store_true", help="overwrite an existing scan")
    args = parser.parse_args()

    config = load_config(args.config)

    companies = [c for c in config.get("companies", []) if c.get("active", True)]
    if args.company:
        wanted = {w.lower() for w in args.company}
        companies = [c for c in companies if c["name"].lower() in wanted or c["slug"].lower() in wanted]
    if not companies:
        print(f"No active companies matched. Check {args.config}.", file=sys.stderr)
        return 1

    title_include = compile_patterns(config.get("title_include"))
    title_exclude = compile_patterns(config.get("title_exclude"))
    location_include = compile_patterns(config.get("location_include"))
    location_exclude = compile_patterns(config.get("location_exclude"))
    us_tokens = compile_patterns(config.get("us_tokens"))
    max_age = args.max_age_days if args.max_age_days is not None else config.get("max_age_days", 45)

    all_records = []
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {}
        for company in companies:
            fetcher = FETCHERS.get(company.get("ats"))
            if not fetcher:
                failures.append((company["name"], f"unknown ats '{company.get('ats')}'"))
                continue
            futures[pool.submit(fetcher, company)] = company
        for future in concurrent.futures.as_completed(futures):
            company = futures[future]
            try:
                all_records.extend(future.result())
            except Exception as error:
                failures.append((company["name"], f"{type(error).__name__}: {error}"))

    seen = {} if args.include_seen else load_seen_keys(args.ledger)

    counts = {"fetched": len(all_records), "title": 0, "location": 0, "stale": 0, "seen": 0}
    candidates = []
    for record in all_records:
        title = record["title"]
        if title_include and not matches_any(title_include, title):
            counts["title"] += 1
            continue
        if title_exclude and matches_any(title_exclude, title):
            counts["title"] += 1
            continue
        if not args.no_location_filter:
            location = record["location"]
            has_us_anchor = matches_any(us_tokens, location) or location.strip().lower() == "remote"
            if location_exclude and not has_us_anchor and matches_any(location_exclude, location):
                counts["location"] += 1
                continue
            if location_include and not record["remote"] and not matches_any(location_include, location):
                counts["location"] += 1
                continue
        days = age_days(record["posted_at"])
        record["age_days"] = days
        if max_age and days is not None and days > max_age:
            counts["stale"] += 1
            continue
        if record["key"] in seen:
            counts["seen"] += 1
            continue
        candidates.append(record)

    counts["duplicate"] = len(candidates)
    candidates = collapse_duplicates(candidates)
    counts["duplicate"] -= len(candidates)

    candidates.sort(key=lambda r: (r["age_days"] if r["age_days"] is not None else 9999, r["company"]))

    out_path = args.out or jobkit.scan_index()
    jd_path = jobkit.scan_descriptions()
    if os.path.exists(out_path) and not args.force:
        try:
            with open(out_path, "r", encoding="utf-8") as handle:
                existing = len(json.load(handle).get("candidates", []))
        except Exception:
            existing = 0
        if existing and len(candidates) < existing:
            print(
                f"refusing to overwrite {out_path}: it holds {existing} candidates and this run "
                f"produced {len(candidates)}.\nIts descriptions are what phases 3-4 read. "
                f"Re-run with --force to replace it, or --out to write elsewhere.",
                file=sys.stderr)
            return 2

    # Descriptions are the bulk of the payload and are read one key at a time,
    # so they live beside the index rather than inside it.
    descriptions = {}
    for record in candidates:
        descriptions[record["key"]] = record.pop("description", "")

    write_json(out_path, {
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "companies_scanned": len(companies) - len(failures),
        "counts": counts,
        "failures": [{"company": name, "error": err} for name, err in failures],
        "descriptions": jd_path,
        "candidates": candidates,
    }, indent=2)
    write_json(jd_path, descriptions)

    print(f"NEW CANDIDATES: {len(candidates)}")
    print(f"written to {out_path}  (descriptions: {jd_path})")
    if failures:
        print("\nboards that failed (likely a wrong slug or a board that moved ATS):")
        for name, err in failures:
            print(f"  - {name}: {err}")
    if candidates:
        print("\n%-26s %-58s %-22s %s" % ("COMPANY", "TITLE", "LOCATION", "AGE"))
        for record in candidates[:40]:
            age = f"{record['age_days']}d" if record["age_days"] is not None else "?"
            print("%-26s %-58s %-22s %s" % (
                record["company"][:25], record["title"][:57], record["location"][:21], age))
    return 0


if __name__ == "__main__":
    sys.exit(main())
