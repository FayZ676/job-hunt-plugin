
import sys
from enum import StrEnum

try:
    from pydantic import BaseModel, ConfigDict, field_validator
except ModuleNotFoundError:
    sys.exit('the jobhunt package is not installed: pip install "$HOME/.claude/skills/job"')

from jobhunt import jobkit

ProfileField = StrEnum("ProfileField", {
    f"{section}.{column}": f"{section}.{column}"
    for section in jobkit.sections() for column in jobkit.columns(section)})


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

    @field_validator("comp_min", "comp_max", mode="before")
    @classmethod
    def _pay(cls, value):
        """a board's "no maximum" sentinel is a negative number, not a salary"""
        return None if value is not None and float(value) < 0 else value

    @field_validator("comp_period")
    @classmethod
    def _period(cls, value: str | None) -> str | None:
        said = (value or "").upper()
        return said if said in jobkit.vocabulary("postings", "comp_period") else None

