#!/usr/bin/env python3
"""Shared helpers for scan.py and indeed_filter.py."""

import json
import os
import re
import sys
from datetime import datetime, timezone

MAX_DESCRIPTION_CHARS = 20000

# ---------------------------------------------------------------------------
# Layout. The one place that knows where anything lives.
#
# career/ splits by owner: files you edit sit at the top level, files you read
# sit in runs/ and resumes/, and everything the system owns lives under
# .state/ -- dot-prefixed so Obsidian and other vault tools ignore it.
# ---------------------------------------------------------------------------

CAREER = os.environ.get("JOB_CAREER_DIR", "career")

# You edit these.
WATCHLIST = f"{CAREER}/watchlist.toml"
INDEED_CONFIG = f"{CAREER}/indeed.toml"
PROFILE = f"{CAREER}/search-profile.md"
INDEX = f"{CAREER}/index.md"
MANUAL_BOARDS = f"{CAREER}/manual-boards.md"

# You read these.
RUNS = f"{CAREER}/runs"
RESUMES = f"{CAREER}/resumes"
SUBMITTED = f"{RESUMES}/submitted"

# The system owns these.
STATE = f"{CAREER}/.state"
LEDGER = f"{STATE}/applications.jsonl"
SCANS = f"{STATE}/scans"
STAGED = f"{STATE}/staged"


def today():
    return datetime.now().strftime("%Y-%m-%d")


def scan_index(date=None):
    """Cheap candidate list: everything but the job descriptions."""
    return f"{SCANS}/{date or today()}.json"


def scan_descriptions(date=None):
    """{key: description}. Read per key, never wholesale."""
    return f"{SCANS}/{date or today()}-jd.json"


def run_entry(date=None):
    return f"{RUNS}/{date or today()}.md"


def load_config(path):
    """Read a TOML config, with a legible error on older Pythons."""
    try:
        import tomllib
    except ModuleNotFoundError:
        sys.exit("Python 3.11+ is required to read TOML config (found "
                 f"{sys.version.split()[0]}). Upgrade Python, or pip install tomli.")
    try:
        with open(path, "rb") as handle:
            return tomllib.load(handle)
    except FileNotFoundError:
        sys.exit(f"missing config: {path}\nRun /job setup to create it.")
    except tomllib.TOMLDecodeError as error:
        sys.exit(f"{path} is not valid TOML: {error}")


def write_json(path, payload, indent=None):
    """System-owned JSON: compact by default, since nothing reads it by eye."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=indent, ensure_ascii=False)

_COMPANY_SUFFIXES = re.compile(
    r"(?i)[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology"
    r"|labs|holdings|group|usa)\b\.?"
)


def compile_patterns(patterns):
    return [re.compile(p) for p in patterns or []]


def matches_any(patterns, text):
    return any(p.search(text or "") for p in patterns)


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def norm_company(name):
    return norm(_COMPANY_SUFFIXES.sub("", name or ""))


def to_iso(value):
    """Epoch seconds, epoch milliseconds, or an ISO string -> ISO string."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 1e11 else value
        try:
            return datetime.fromtimestamp(seconds, timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return to_iso(int(text))
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return text


def age_days(posted_at):
    if not posted_at:
        return None
    try:
        moment = datetime.fromisoformat(str(posted_at).replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - moment).days


def iter_ledger(path):
    """Yield each well-formed JSON object in a .jsonl ledger, skipping junk."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue
