
import html
import json
import re
import time
import urllib.request

from jobkit import MAX_DESCRIPTION_CHARS, to_iso
from models import Posting

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) job-scan/1.0"
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"[ \t\r\f\v]+")
BLANKS_RE = re.compile(r"\n{3,}")
VIEWJOB = "https://www.indeed.com/viewjob?jk={}"
APPLYSTART = "https://www.indeed.com/applystart?jk={}&from=vj"


def http_get_json(url, timeout=25, attempts=3):
    last_error = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8", "replace"))
        except Exception as error:
            last_error = error
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
    raise last_error


def html_to_text(raw):
    if not raw:
        return ""
    text = html.unescape(str(raw))
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|tr)>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "- ", text)
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = WS_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return BLANKS_RE.sub("\n\n", text).strip()


ENDPOINT = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
    "lever":      "https://api.lever.co/v0/postings/{slug}?mode=json",
    "ashby":      "https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true",
    "indeed":     "browser harvest, loaded from a file -- no endpoint",
}

QUIRK = {
    "greenhouse": "`content` is HTML-escaped HTML, unescaped twice here. Without ?content=true "
                  "there are no descriptions to score on",
    "lever":      "returns a BARE ARRAY; createdAt is epoch ms; a posting splits across "
                  "descriptionPlain, `lists` and `additional`. A live board with no postings "
                  "returns [] at 200, a wrong slug 404s",
    "ashby":      "best payload: descriptionPlain needs no HTML handling, isRemote is a real "
                  "boolean, compensation bands come back. isListed:false normalizes to expired",
    "indeed":     "navigate, never fetch() -- see references/fetching.md for the harvest",
}

def greenhouse(company):
    slug = company["slug"]
    payload = http_get_json(ENDPOINT["greenhouse"].format(slug=slug))
    out = []
    for job in payload.get("jobs", []):
        location = ((job.get("location") or {}).get("name") or "").strip()
        out.append(Posting(
            key=f"greenhouse:{slug}:{job.get('id')}",
            source="greenhouse", ats="greenhouse",
            company=company["name"], title=(job.get("title") or "").strip(),
            url=job.get("absolute_url"), apply_url=job.get("absolute_url"),
            location=location, remote=int("remote" in location.lower()),
            posted_at=to_iso(job.get("first_published") or job.get("updated_at")),
            description=html_to_text(job.get("content"))[:MAX_DESCRIPTION_CHARS]))
    return out


def _lever_description(job):
    parts = [job.get("descriptionPlain") or html_to_text(job.get("description"))]
    for section in job.get("lists") or []:
        heading = (section.get("text") or "").strip()
        body = html_to_text(section.get("content"))
        if heading:
            parts.append(heading)
        if body:
            parts.append(body)
    parts.append(job.get("additionalPlain") or html_to_text(job.get("additional")))
    return "\n\n".join(part for part in parts if part)[:MAX_DESCRIPTION_CHARS]


def lever(company):
    slug = company["slug"]
    payload = http_get_json(ENDPOINT["lever"].format(slug=slug))
    if not isinstance(payload, list):
        raise ValueError("lever board returned no posting list")
    out = []
    for job in payload:
        categories = job.get("categories") or {}
        locations = categories.get("allLocations") or []
        location = categories.get("location") or (locations[0] if locations else "")
        workplace = (job.get("workplaceType") or "").lower()
        salary = job.get("salaryRange") or {}
        out.append(Posting(
            key=f"lever:{slug}:{job.get('id')}",
            source="lever", ats="lever",
            company=company["name"], title=(job.get("text") or "").strip(),
            url=job.get("hostedUrl"), apply_url=job.get("applyUrl") or job.get("hostedUrl"),
            location=", ".join(locations) if locations else str(location).strip(),
            remote=int(workplace == "remote" or "remote" in str(location).lower()),
            compensation=(
                f"{salary.get('min')}-{salary.get('max')} {salary.get('currency') or ''}".strip()
                if salary.get("min") else None),
            comp_min=salary.get("min"), comp_max=salary.get("max"),
            comp_period="YEARLY" if salary.get("interval") in (None, "per-year-salary") else None,
            posted_at=to_iso(job.get("createdAt")),
            description=_lever_description(job)))
    return out


def ashby(company):
    slug = company["slug"]
    payload = http_get_json(ENDPOINT["ashby"].format(slug=slug))
    out = []
    for job in payload.get("jobs", []):
        secondary = job.get("secondaryLocations") or []
        extra = [s.get("location") for s in secondary if isinstance(s, dict) and s.get("location")]
        location = ", ".join([job.get("location") or ""] + extra).strip(", ")
        compensation = job.get("compensation") or {}
        summary = compensation.get("compensationTierSummary") if isinstance(compensation, dict) else None
        out.append(Posting(
            key=f"ashby:{slug}:{job.get('id')}",
            source="ashby", ats="ashby",
            company=company["name"], title=(job.get("title") or "").strip(),
            url=job.get("jobUrl"), apply_url=job.get("applyUrl") or job.get("jobUrl"),
            location=location,
            remote=int(bool(job.get("isRemote")) or "remote" in location.lower()),
            compensation=summary,
            expired=int(job.get("isListed") is False),
            posted_at=to_iso(job.get("publishedAt")),
            description=(job.get("descriptionPlain")
                         or html_to_text(job.get("descriptionHtml")))[:MAX_DESCRIPTION_CHARS]))
    return out


def indeed(harvest_path):
    with open(harvest_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if isinstance(payload, dict):
        blocks = payload.get("results") or []
        cards = [c for b in blocks for c in (b.get("rows") or [])] if blocks else payload.get("rows", [])
    else:
        cards = payload

    out = []
    for card in cards:
        jobkey = card.get("jobkey")
        if not jobkey:
            continue
        salary = card.get("extractedSalary") or {}
        remote = (card.get("remoteWorkModel") or {}).get("type") or ""
        location = card.get("formattedLocation") or ""
        low, high = salary.get("min"), salary.get("max")
        stated = None
        if low or high:
            unit = (salary.get("type") or "").lower()
            stated = (f"{low:,.0f}-{high:,.0f} {unit}".strip() if low and high
                      else f"{(low or high):,.0f} {unit}".strip())
        out.append(Posting(
            key=f"indeed:{jobkey}",
            source="indeed", ats=None,
            company=card.get("company") or "", title=(card.get("title") or "").strip(),
            url=VIEWJOB.format(jobkey), apply_url=APPLYSTART.format(jobkey),
            location=location,
            remote=int(bool(remote) or "remote" in location.lower()),
            compensation=stated,
            comp_min=low, comp_max=high,
            comp_period=(salary.get("type") or "").upper() or None,
            sponsored=int(bool(card.get("sponsored"))),
            expired=int(bool(card.get("expired"))),
            posted_at=to_iso(card.get("pubDate")),
            raw=json.dumps(card, ensure_ascii=False)))
    return out


REGISTRY = {
    "greenhouse": {"fetch": greenhouse, "kind": "board", "rank": 0},
    "lever":      {"fetch": lever,      "kind": "board", "rank": 0},
    "ashby":      {"fetch": ashby,      "kind": "board", "rank": 0},
    "indeed":     {"fetch": indeed,     "kind": "harvest", "rank": 1},
}

assert set(REGISTRY) == set(ENDPOINT) == set(QUIRK), "a source is missing an endpoint or a quirk"


def describe():
    for name, entry in sorted(REGISTRY.items(), key=lambda kv: (kv[1]["rank"], kv[0])):
        print(f"{name}  [{entry['kind']}, rank {entry['rank']}]")
        print(f"  {ENDPOINT[name]}")
        print(f"  {QUIRK[name]}\n")
    return 0

BOARDS = {name: s["fetch"] for name, s in REGISTRY.items() if s["kind"] == "board"}
RANK = {name: s["rank"] for name, s in REGISTRY.items()}


def rank(source):
    return RANK.get(source, 99)
