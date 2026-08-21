#!/usr/bin/env python3
"""Shared helpers for scan.py and indeed_filter.py."""

import json
import os
import re
from datetime import datetime, timezone

MAX_DESCRIPTION_CHARS = 20000

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
