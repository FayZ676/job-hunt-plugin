
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

import dateutil.parser
from tabulate import tabulate

MAX_DESCRIPTION_CHARS = 20000


DEFAULT_CAREER = "~/data/job"
CAREER = os.path.abspath(
    os.path.expanduser(os.environ.get("JOB_CAREER_DIR") or DEFAULT_CAREER)
)

DB = f"{CAREER}/job.db"
RESUMES = f"{CAREER}/resumes"
SUBMITTED = f"{RESUMES}/submitted"

SQL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sql")
SCHEMA_PARTS = tuple(os.path.join(SQL, f"{name}.sql") for name in ("job", "profile"))


def schema():
    return "\n".join(open(part, encoding="utf-8").read() for part in SCHEMA_PARTS)


def connect(path=None):
    path = path or DB
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(schema())
    return con


def body(table):
    """the column declarations of one table, straight from the DDL"""
    found = re.search(rf"CREATE TABLE IF NOT EXISTS {table} \((.*?)\n\)[^;]*;", schema(), re.S)
    return found.group(1) if found else ""


def sections():
    """the profile's sections -- the single-row tables, in declaration order"""
    return [m.group(1) for m in re.finditer(
        r"CREATE TABLE IF NOT EXISTS (\w+) \(\s*\n\s*id\s+INTEGER PRIMARY KEY CHECK \(id = 1\)",
        schema())]


def columns(table):
    """every column of a table but its id, in declaration order"""
    return [m.group(1) for m in re.finditer(r"^  (\w+)\s+(?:INTEGER|TEXT|REAL)", body(table), re.M)
            if m.group(1) != "id"]


def declared(table, column):
    """the type and CHECK one column was declared with"""
    found = re.search(rf"^  {column}\s+(INTEGER|TEXT|REAL)(.*?)(?=\n  \w+\s+(?:INTEGER|TEXT|REAL)"
                      rf"|\n  CHECK|\n  PRIMARY KEY|\Z)", body(table), re.M | re.S)
    return found.groups() if found else ("TEXT", "")


def choices(table, column):
    """the words one column's CHECK allows, in declaration order"""
    listed = re.search(rf"{column} IN \((\s*'.*?)\)", declared(table, column)[1], re.S)
    return re.findall(r"'([^']+)'", listed.group(1)) if listed else []


def vocabulary(table, column):
    return set(choices(table, column))


SHAPES = (
    (r"IN \(0,1\)", "0 or 1"),
    (r">= 0", "a whole number, 0 or more"),
    (r"date\(\w+ \|\| '-01'\)", "a year, a year and month, or a full date"),
    (r"IS date\(", "a date, as YYYY-MM-DD"),
    (r"datetime\(\w+\) IS NOT NULL", "a timestamp"),
    (r"GLOB '\[0-2\]\[0-9\]:", "a 24-hour time, as HH:MM"),
    (r"GLOB '\[A-Z\]\[A-Z\]\[A-Z\]'", "a three-letter currency code, like USD"),
    (r"LIKE '_%@_%\._%'", "an email address"),
    (r"LIKE 'http%://%\.%'", "a URL, starting http"),
    (r"NOT \w+ GLOB '\*\[A-Za-z\]\*'", "a phone number -- digits and separators, no words"),
)


def takes(table, column):
    """the shape sql/*.sql declares for one column, in words"""
    kind, check = declared(table, column)
    listed = choices(table, column)
    if listed:
        return "one of " + ", ".join(listed)
    for pattern, phrase in SHAPES:
        if re.search(pattern, check):
            return phrase
    return "a whole number" if kind == "INTEGER" else "anything but an empty answer"


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
    text = str(value).strip()
    if isinstance(value, (int, float)) or text.isdigit():
        seconds = float(text)
        try:
            return datetime.fromtimestamp(seconds / 1000 if seconds > 1e11 else seconds,
                                          timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    try:
        return dateutil.parser.isoparse(text).isoformat()
    except ValueError:
        return text


def age_days(posted_at):
    if not posted_at:
        return None
    try:
        moment = dateutil.parser.isoparse(str(posted_at))
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - moment).days


def print_rows(rows, as_json=False):
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    elif not rows:
        print("(no rows)")
    else:
        print(tabulate(rows, headers="keys", maxcolwidths=48, disable_numparse=True))


PATHS = {"career": CAREER, "db": DB,
         "resumes": RESUMES, "submitted": SUBMITTED}


def main():
    requested = sys.argv[1:] or ["career"]
    unknown = [name for name in requested if name not in PATHS]
    if unknown:
        sys.exit(f"unknown path {unknown[0]!r}; choose from {', '.join(PATHS)}")
    for name in requested:
        print(PATHS[name])
    return 0


if __name__ == "__main__":
    sys.exit(main())
