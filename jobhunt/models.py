
import re
import sys
from typing import Literal, get_args

__all__ = ["Row", "Posting", "Status", "Disposition", "Tier",
           "get_args", "verify_against_schema"]

try:
    from pydantic import BaseModel, ConfigDict, field_validator
except ModuleNotFoundError:
    sys.exit(
        "This skill needs pydantic:  python3 -m pip install pydantic\n"
        "(Scanning needs it; nothing else does.)")

from jobhunt import jobkit

Status = Literal["new", "scored", "shortlisted", "skipped", "staged", "applied",
                 "interviewing", "rejected", "not_pursued", "closed"]

Disposition = Literal["kept", "upgraded", "title", "location", "stale", "seen",
                      "duplicate", "sponsored", "expired", "agency", "noise",
                      "lowball", "covered"]

Tier = Literal["identity", "policy", "judgment"]


class Row(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("remote", "sponsored", "expired", mode="before", check_fields=False)
    @classmethod
    def _flag(cls, value):
        return False if value is None else value

    def row(self) -> dict:
        data = self.model_dump()
        for name, field in type(self).model_fields.items():
            if field.annotation is bool:
                data[name] = int(data[name])
        return data


class Posting(Row):
    key: str
    source: str
    company: str
    title: str
    ats: str | None = None
    url: str | None = None
    apply_url: str | None = None
    location: str = ""
    remote: bool = False
    compensation: str | None = None
    posted_at: str | None = None
    description: str | None = None

    comp_min: float | None = None
    comp_max: float | None = None
    comp_period: str | None = None

    sponsored: bool = False
    expired: bool = False
    raw: str | None = None

    @field_validator("key")
    @classmethod
    def _namespaced(cls, value: str) -> str:
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


def _schema_vocabulary(table: str, column: str) -> set[str]:
    sql = open(jobkit.SCHEMA_SQL, encoding="utf-8").read()
    body = re.search(rf"CREATE TABLE IF NOT EXISTS {table} \((.*?)\n\);", sql, re.S)
    if not body:
        raise AssertionError(f"no {table} table in schema.sql")
    listed = re.search(rf"{column}\s+TEXT.*?IN \((.*?)\)\)", body.group(1), re.S)
    if not listed:
        raise AssertionError(f"no CHECK IN list on {table}.{column}")
    return set(re.findall(r"'([^']+)'", listed.group(1)))


def verify_against_schema() -> None:
    for table, column, literal in (("postings", "status", Status),
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
