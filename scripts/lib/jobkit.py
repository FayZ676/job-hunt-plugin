
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

MAX_DESCRIPTION_CHARS = 20000


DEFAULT_CAREER = "~/data/job"
CAREER = os.path.abspath(
    os.path.expanduser(os.environ.get("JOB_CAREER_DIR") or DEFAULT_CAREER)
)

DB = f"{CAREER}/job.db"
RESUMES = f"{CAREER}/resumes"
SUBMITTED = f"{RESUMES}/submitted"

_HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_SQL = os.path.join(_HERE, "..", "..", "sql", "schema.sql")


def connect(path=None):
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
    return norm(_COMPANY_SUFFIXES.sub("", name or ""))


def to_iso(value):
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


def print_rows(rows, as_json=False):
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("(no rows)")
        return 0
    columns = list(rows[0])
    width = {c: min(max(len(c), *(len(str(r.get(c) or "")) for r in rows)), 48) for c in columns}
    print("  ".join(c.ljust(width[c]) for c in columns))
    for row in rows:
        print("  ".join(
            str(row.get(c) if row.get(c) is not None else "")[:width[c]].ljust(width[c])
            for c in columns))
    return 0


PATHS = {"career": CAREER, "db": DB,
         "resumes": RESUMES, "submitted": SUBMITTED}


if __name__ == "__main__":
    requested = sys.argv[1:] or ["career"]
    unknown = [name for name in requested if name not in PATHS]
    if unknown:
        sys.exit(f"unknown path {unknown[0]!r}; choose from {', '.join(PATHS)}")
    for name in requested:
        print(PATHS[name])
