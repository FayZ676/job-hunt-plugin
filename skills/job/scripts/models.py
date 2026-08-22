#!/usr/bin/env python3
"""The structured types every source produces and the raw layer stores.

Vendor payloads are the messiest input in the system: four sources, no two
agreeing on a field name, a date format, or whether a missing value arrives as
null, "" or an absent key. Parsing them into one validated type at the boundary
is what lets everything downstream read a posting without defensive checks --
and turns a source that starts returning nonsense into an error naming the
field, rather than an SQL failure several steps later.
"""

import re
import sys
from typing import Literal, get_args

__all__ = ["Posting", "StoredPosting", "Prospect", "Status", "Disposition", "Tier",
           "get_args", "verify_against_schema"]

try:
    from pydantic import BaseModel, ConfigDict, field_validator
except ModuleNotFoundError:
    sys.exit(
        "This plugin needs pydantic:  python3 -m pip install pydantic\n"
        "(Scanning needs it; nothing else does.)")

import jobkit

SOURCE_KINDS = ("board", "harvest")

# The controlled vocabularies. The database enforces these with CHECK
# constraints and the models enforce them here; `verify_against_schema` fails
# loudly if the two ever disagree, so there is one vocabulary, not two copies
# that drift.
Status = Literal["new", "scored", "shortlisted", "skipped", "staged", "applied",
                 "interviewing", "rejected", "not_pursued", "closed"]

Disposition = Literal["kept", "upgraded", "title", "location", "stale", "seen",
                      "duplicate", "sponsored", "expired", "agency", "noise",
                      "lowball", "covered"]

Tier = Literal["identity", "policy", "judgment"]


class Posting(BaseModel):
    """One posting as a source found it, normalized but unjudged.

    Sources fill in what their payload states and leave the rest at the
    default. A default means "this source does not say", never "no" -- ingest
    treats an unstated fact as unremarkable, which is what keeps every filter
    applicable to every source.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    key: str
    source: str
    company: str
    title: str
    ats: str | None = None
    url: str | None = None
    apply_url: str | None = None
    location: str = ""
    remote: bool = False
    description: str | None = None
    posted_at: str | None = None

    compensation: str | None = None
    comp_min: float | None = None
    comp_max: float | None = None
    comp_period: str | None = None

    sponsored: bool = False
    expired: bool = False
    raw: str | None = None

    @field_validator("key")
    @classmethod
    def _namespaced(cls, value: str) -> str:
        """Keys are `<source>:<id>` so two sources can never collide, and the
        prefix tells the applying phase which ATS it is about to drive."""
        if ":" not in value or value.endswith(":"):
            raise ValueError(f"key must be '<source>:<id>', got {value!r}")
        return value

    @field_validator("company", "title")
    @classmethod
    def _present(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("company and title cannot be blank")
        return value

    @field_validator("comp_period")
    @classmethod
    def _period(cls, value: str | None) -> str | None:
        return value.upper() if value else None

    def row(self) -> dict:
        """The shape `postings` stores. Booleans become the integers SQLite keeps."""
        data = self.model_dump()
        for flag in ("remote", "sponsored", "expired"):
            data[flag] = int(data[flag])
        return data


class StoredPosting(Posting):
    """A row of `postings`: what a source produced, plus what ingest ruled.

    Reading through this rather than a bare sqlite3.Row means a column that
    changes type, or a disposition the vocabulary does not contain, fails at
    the read instead of quietly flowing into a filter.
    """

    first_fetched: str | None = None
    last_fetched: str | None = None
    ingested_on: str | None = None
    disposition: Disposition | None = None

    @classmethod
    def from_row(cls, row) -> "StoredPosting":
        return cls(**{k: row[k] for k in row.keys()})


class Prospect(BaseModel):
    """A row of `prospects`: a posting ingest kept, and everything scoring and
    applying add to it afterwards."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    key: str
    company: str
    title: str
    url: str | None = None
    apply_url: str | None = None
    location: str = ""
    remote: bool = False
    compensation: str | None = None
    posted_at: str | None = None
    first_seen: str | None = None
    last_seen: str | None = None
    source: str | None = None
    ats: str | None = None
    description: str | None = None
    score: int | None = None
    reason: str | None = None
    resume: str | None = None
    status: Status = "new"

    @field_validator("score")
    @classmethod
    def _in_range(cls, value: int | None) -> int | None:
        if value is not None and not 0 <= value <= 10:
            raise ValueError(f"score must be 0-10, got {value}")
        return value

    @classmethod
    def from_posting(cls, posting: "StoredPosting") -> "Prospect":
        """Promotion is a projection: the columns both tables share, nothing invented."""
        shared = set(cls.model_fields) & set(posting.model_fields)
        return cls(**{name: getattr(posting, name) for name in shared})

    def row(self) -> dict:
        data = self.model_dump()
        data["remote"] = int(data["remote"])
        return data


def _schema_vocabulary(table: str, column: str) -> set[str]:
    """Pull the CHECK ... IN (...) list for one column out of schema.sql."""
    sql = open(jobkit.SCHEMA_SQL, encoding="utf-8").read()
    body = re.search(rf"CREATE TABLE IF NOT EXISTS {table} \((.*?)\n\);", sql, re.S)
    if not body:
        raise AssertionError(f"no {table} table in schema.sql")
    listed = re.search(rf"{column}\s+TEXT.*?IN \((.*?)\)\)", body.group(1), re.S)
    if not listed:
        raise AssertionError(f"no CHECK IN list on {table}.{column}")
    return set(re.findall(r"'([^']+)'", listed.group(1)))


def verify_against_schema() -> None:
    """Fail if a model's vocabulary has drifted from the database's."""
    for table, column, literal in (("prospects", "status", Status),
                                   ("postings", "disposition", Disposition),
                                   ("staged_fields", "tier", Tier)):
        in_schema = _schema_vocabulary(table, column)
        in_model = set(get_args(literal))
        if in_schema != in_model:
            raise AssertionError(
                f"{table}.{column} disagrees with models.py\n"
                f"  only in schema: {sorted(in_schema - in_model)}\n"
                f"  only in model:  {sorted(in_model - in_schema)}")


if __name__ == "__main__":
    verify_against_schema()
    print("models and schema agree")
