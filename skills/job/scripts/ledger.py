#!/usr/bin/env python3
"""The ledger: append-only history of every posting ever seen.

Exists so nothing hand-writes JSON into the file that is the system's memory.
A malformed line there is not a crash -- it is a posting that silently
resurfaces, or an application recorded as never sent.

  ledger.py append --key … --company … --title … --status queued [--score 8] …
  ledger.py status <key> --status applied [--resume path] [--note …]
  ledger.py get <key>            latest state for one key
  ledger.py keys                 every key ever seen, one per line
  ledger.py stats                counts by status
"""

import argparse
import json
import sys
from datetime import datetime, timezone

import jobkit
from jobkit import iter_ledger

STATUSES = ["queued", "surfaced", "skipped", "staged", "applied",
            "interviewing", "rejected", "not_pursued", "closed"]


def latest(path):
    """Last line wins, per key."""
    state = {}
    for entry in iter_ledger(path):
        if entry.get("key"):
            state[entry["key"]] = entry
    return state


def append(path, record):
    import os
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    line = json.dumps(record, ensure_ascii=False, sort_keys=False)
    assert "\n" not in line
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def cmd_append(args):
    if args.status not in STATUSES:
        sys.exit(f"unknown status {args.status!r}; one of {', '.join(STATUSES)}")
    record = {
        "key": args.key,
        "company": args.company,
        "title": args.title,
        "url": args.url,
        "location": args.location,
        "posted_at": args.posted_at,
        "first_seen": args.first_seen or jobkit.today(),
        "score": args.score,
        "reason": args.reason,
        "status": args.status,
    }
    if args.resume:
        record["resume"] = args.resume
    record = {k: v for k, v in record.items() if v is not None}
    append(args.ledger, record)
    print(f"{args.key} -> {args.status}")
    return 0


def cmd_status(args):
    if args.status not in STATUSES:
        sys.exit(f"unknown status {args.status!r}; one of {', '.join(STATUSES)}")
    state = latest(args.ledger)
    if args.key not in state:
        sys.exit(f"no ledger entry for {args.key!r}. Append it first.")
    record = dict(state[args.key])
    record["status"] = args.status
    record[f"{args.status}_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if args.resume is not None:
        record["resume"] = args.resume or None
    if args.resume_deleted:
        record["resume_deleted"] = args.resume_deleted
        record["resume"] = None
    if args.note:
        record["note"] = args.note
    append(args.ledger, record)
    print(f"{args.key} -> {args.status}")
    return 0


def cmd_get(args):
    entry = latest(args.ledger).get(args.key)
    if not entry:
        sys.exit(f"no ledger entry for {args.key!r}")
    print(json.dumps(entry, indent=2, ensure_ascii=False))
    return 0


def cmd_keys(args):
    for entry in iter_ledger(args.ledger):
        if entry.get("key"):
            print(entry["key"])
        for extra in entry.get("duplicate_keys") or []:
            print(extra)
    return 0


def cmd_stats(args):
    import collections
    counts = collections.Counter(e.get("status", "?") for e in latest(args.ledger).values())
    total = sum(counts.values())
    for status, n in counts.most_common():
        print(f"{n:5}  {status}")
    print(f"{total:5}  total unique postings")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ledger", default=jobkit.LEDGER)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("append", help="add a newly seen posting")
    for flag in ("key", "company", "title"):
        a.add_argument(f"--{flag}", required=True)
    for flag in ("url", "location", "posted_at", "first_seen", "reason", "resume"):
        a.add_argument(f"--{flag}")
    a.add_argument("--score", type=int)
    a.add_argument("--status", default="queued")
    a.set_defaults(func=cmd_append)

    s = sub.add_parser("status", help="record a status change")
    s.add_argument("key")
    s.add_argument("--status", required=True)
    s.add_argument("--resume")
    s.add_argument("--resume-deleted")
    s.add_argument("--note")
    s.set_defaults(func=cmd_status)

    g = sub.add_parser("get", help="latest state for one key"); g.add_argument("key"); g.set_defaults(func=cmd_get)
    sub.add_parser("keys", help="every key ever seen").set_defaults(func=cmd_keys)
    sub.add_parser("stats", help="counts by status").set_defaults(func=cmd_stats)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
