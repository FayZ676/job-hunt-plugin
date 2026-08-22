#!/usr/bin/env python3
"""Move a pre-1.1 career/ directory to the ownership-split layout.

  career/scan-config.json      -> career/watchlist.toml
  career/indeed-queries.json   -> career/indeed.toml
  career/applications.jsonl    -> career/.state/applications.jsonl
  career/staged/               -> career/.state/staged/
  career/jobs/<date>.md        -> career/runs/<date>.md
  career/jobs/<date>-*.json    -> career/.state/scans/

Dry run by default. Pass --apply to move anything.
"""

import argparse
import json
import os
import shutil
import sys

import jobkit


def lit(s):
    if "\\" in s or "'" in s:
        return "'" + s + "'" if "'" not in s else json.dumps(s)
    return json.dumps(s)


def to_toml_watchlist(cfg):
    L = ["# Which companies to watch, and the mechanical filters applied to every posting.", ""]
    L.append(f"max_age_days = {cfg.get('max_age_days', 30)}")
    for key in ("title_include", "title_exclude", "location_include", "location_exclude", "us_tokens"):
        if key in cfg:
            L += ["", f"{key} = ["] + [f"  {lit(p)}," for p in cfg[key]] + ["]"]
    L += ["", "companies = ["]
    for c in cfg.get("companies", []):
        extra = "" if c.get("active", True) else ", active = false"
        L.append(f'  {{ name = {json.dumps(c["name"])}, ats = "{c["ats"]}", slug = {json.dumps(c["slug"])}{extra} }},')
    L.append("]")
    return "\n".join(L) + "\n"


def to_toml_indeed(cfg):
    L = ["# The Indeed pass: what to search for, and what to throw away.", ""]
    for key, val in cfg.items():
        if key.startswith("_"):
            continue
        if isinstance(val, bool):
            L.append(f"{key} = {'true' if val else 'false'}")
        elif isinstance(val, (int, float)):
            L.append(f"{key} = {val}")
        elif isinstance(val, str):
            L.append(f"{key} = {lit(val)}")
        elif isinstance(val, list):
            if val and isinstance(val[0], dict):
                L += [f"{key} = ["]
                for item in val:
                    parts = [f"{k} = {json.dumps(v) if isinstance(v,str) else v}" for k, v in item.items()]
                    L.append("  { " + ", ".join(parts) + " },")
                L.append("]")
            else:
                L += [f"{key} = ["] + [f"  {lit(str(x))}," for x in val] + ["]"]
        L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--career", default=jobkit.CAREER)
    ap.add_argument("--apply", action="store_true", help="actually move files (default: dry run)")
    args = ap.parse_args()
    C = args.career
    if not os.path.isdir(C):
        sys.exit(f"no such directory: {C}")

    plan = []
    def move(src, dst):
        if os.path.exists(src):
            plan.append(("move", src, dst))
    def convert(src, dst, fn):
        if os.path.exists(src) and not os.path.exists(dst):
            plan.append(("convert", src, dst, fn))

    convert(f"{C}/scan-config.json", f"{C}/watchlist.toml", to_toml_watchlist)
    convert(f"{C}/indeed-queries.json", f"{C}/indeed.toml", to_toml_indeed)
    move(f"{C}/applications.jsonl", f"{C}/.state/applications.jsonl")
    move(f"{C}/staged", f"{C}/.state/staged")
    if os.path.isdir(f"{C}/jobs"):
        for name in sorted(os.listdir(f"{C}/jobs")):
            src = f"{C}/jobs/{name}"
            dst = f"{C}/runs/{name}" if name.endswith(".md") else f"{C}/.state/scans/{name}"
            plan.append(("move", src, dst))

    if not plan:
        print("nothing to migrate; layout already current")
        return 0

    for step in plan:
        print(f"  {step[0]:8} {step[1]}  ->  {step[2]}")
    if not args.apply:
        print(f"\n{len(plan)} steps. Dry run — re-run with --apply to perform them.")
        return 0

    for step in plan:
        kind, src, dst = step[0], step[1], step[2]
        os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
        if kind == "convert":
            with open(src, "r", encoding="utf-8") as h:
                cfg = json.load(h)
            with open(dst, "w", encoding="utf-8") as h:
                h.write(step[3](cfg))
            print(f"  wrote {dst}  (left {src} in place; delete it once you are happy)")
        else:
            shutil.move(src, dst)
            print(f"  moved {dst}")
    for empty in (f"{C}/jobs",):
        if os.path.isdir(empty) and not os.listdir(empty):
            os.rmdir(empty)
    print("\nmigration complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
