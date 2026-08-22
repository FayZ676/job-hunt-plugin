#!/usr/bin/env python3
"""Shared helpers: the database connection, paths, and the normalization
every step agrees on."""

import json
import os
import re
import sqlite3
from datetime import datetime, timezone

MAX_DESCRIPTION_CHARS = 20000

# ---------------------------------------------------------------------------
# Layout. The one place that knows where anything lives.
#
# The data directory holds the database the system owns and the resumes it
# builds. Nothing here is hidden: it is the user's data, not internal state.
# ---------------------------------------------------------------------------

DEFAULT_CAREER = "~/data/job"
CAREER = os.path.abspath(
    os.path.expanduser(os.environ.get("JOB_CAREER_DIR") or DEFAULT_CAREER)
)

# The system owns this. One database: prospects, companies, filters, staged.
DB = f"{CAREER}/job.db"
RESUMES = f"{CAREER}/resumes"
SUBMITTED = f"{RESUMES}/submitted"

# Shipped with the plugin, not the user.
_HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_SQL = os.path.join(_HERE, "..", "sql", "schema.sql")


def connect(path=None):
    """Open the database, applying the schema. Every statement in it is
    idempotent, so this doubles as `init`."""
    path = path or DB
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    with open(SCHEMA_SQL, encoding="utf-8") as handle:
        con.executescript(handle.read())
    return con


def compile_patterns(patterns):
    return [re.compile(p) for p in patterns or []]


def matches_any(patterns, text):
    return any(p.search(text or "") for p in patterns)


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


_COMPANY_SUFFIXES = re.compile(
    r"(?i)[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology"
    r"|labs|holdings|group|usa)\b\.?"
)


def norm_company(name):
    """Two sources rarely spell a company the same way, and dedupe compares
    these, so the legal suffix comes off before anything is matched."""
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


PATHS = {"career": CAREER, "db": DB,
         "resumes": RESUMES, "submitted": SUBMITTED}


if __name__ == "__main__":
    import sys
    requested = sys.argv[1:] or ["career"]
    unknown = [name for name in requested if name not in PATHS]
    if unknown:
        sys.exit(f"unknown path {unknown[0]!r}; choose from {', '.join(PATHS)}")
    for name in requested:
        print(PATHS[name])
