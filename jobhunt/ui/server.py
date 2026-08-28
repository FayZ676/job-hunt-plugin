"""Serve the local dashboard: a window onto the job database, and the one
place the user edits their own profile by hand.

  job-ui                 serve on the first free port from 8765
  job-ui --port 9000     pin the port
  job-ui --no-open       do not open a browser
  job-ui --lan           also answer other devices on this network, key-gated
  job-ui --host 0.0.0.0  pin the bind address

Binding past the loopback mints an access key: another device must carry it,
as ?k= once and as a cookie thereafter. Reads open the database `mode=ro`; the
write endpoints touch only the profile tables, and only from this page -- a
cross-origin request is refused before it reaches one.
"""

import os
import secrets
import socket
import sqlite3
import sys
import threading
import webbrowser

import typer
import uvicorn
from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from starlette.exceptions import HTTPException as AnyHTTPException

from jobhunt import jobkit

_HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(_HERE, "index.html")
HELP = os.path.join(_HERE, os.pardir, "help.txt")

ACCESS = None
LOOPBACK = ("127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1")

LISTS = {
    "stats": "SELECT status, n FROM stats",
    "jobs": "SELECT * FROM triage",
    "profile": "SELECT rowid AS rowid, field, value, section, notes FROM profile ORDER BY section, field",
    "education": "SELECT rowid AS rowid, degree, institution, finished FROM education",
    "criteria": "SELECT rowid AS rowid, kind, value, weight, note FROM search_criteria"
                " ORDER BY kind, seq IS NULL, seq, value",
    "notes": "SELECT rowid AS rowid, topic, note FROM search_notes ORDER BY topic",
    "facts": "SELECT rowid AS rowid, fact FROM facts ORDER BY rowid",
    "accounts": "SELECT rowid AS rowid, employer, system, portal_url, login_email, password_location, created"
                " FROM accounts ORDER BY employer",
    "limits": "SELECT rowid AS rowid, company, stated FROM company_limits ORDER BY company",
    "companies": "SELECT slug, ats, name, active, source, careers_url, cadence, last_checked"
                 " FROM companies ORDER BY ats, name",
    "manual_boards": "SELECT name, slug, cadence, last_checked, careers_url FROM manual_boards",
    "filters": "SELECT kind, pattern, note FROM filters ORDER BY kind, pattern",
}


def rows(sql, args=()):
    con = sqlite3.connect(f"file:{jobkit.DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(sql, args).fetchall()]
    finally:
        con.close()


def one(sql, args=()):
    found = rows(sql, args)
    return found[0] if found else None


def prospect(key):
    found = one("SELECT * FROM prospects WHERE key=?", (key,))
    if not found:
        return None
    found["events"] = rows("SELECT at, status, note FROM events WHERE key=? ORDER BY id", (key,))
    found["staged"] = one("SELECT url, ats, screenshot, status, blocked_on FROM staged WHERE key=?", (key,))
    found["fields"] = rows("SELECT label, value, tier, flag FROM staged_fields WHERE key=? ORDER BY rowid", (key,))
    found["aliases"] = [r["key"] for r in rows("SELECT key FROM postings WHERE canonical_key=?", (key,))]
    return found


def career():
    employers = rows("SELECT rowid AS rowid, name, title, start, finish, current, context, seq"
                     " FROM employers ORDER BY seq IS NULL, seq, rowid")
    projects = rows("SELECT rowid AS rowid, employer_id, name, start, finish, status, summary,"
                    " shared_with, notes, seq FROM projects ORDER BY seq IS NULL, seq, rowid")
    children = {
        "bullets": rows("SELECT rowid AS rowid, project_id, text FROM project_bullets"
                        " ORDER BY project_id, seq IS NULL, seq, rowid"),
        "technologies": rows("SELECT rowid AS rowid, project_id, technology FROM project_technologies"
                             " ORDER BY project_id, technology"),
        "metrics": rows("SELECT rowid AS rowid, project_id, metric FROM project_metrics"
                        " ORDER BY project_id, rowid"),
        "links": rows("SELECT rowid AS rowid, project_id, label, url FROM project_links"
                      " ORDER BY project_id, rowid"),
    }
    for project in projects:
        for name, found in children.items():
            project[name] = [r for r in found if r["project_id"] == project["rowid"]]
    for employer in employers:
        employer["projects"] = [p for p in projects if p["employer_id"] == employer["rowid"]]
    return employers


def asset(kind, key):
    table = {"resume": "postings", "screenshot": "staged"}.get(kind)
    if not table:
        return None
    path = one(f"SELECT {kind} AS p FROM {table} WHERE key=?", (key,))
    if not path or not path["p"]:
        return None
    resolved = os.path.realpath(os.path.expanduser(path["p"]))
    if not resolved.startswith(os.path.realpath(jobkit.CAREER) + os.sep):
        return None
    return resolved if os.path.isfile(resolved) else None


def lan_ip():
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 9))
        return probe.getsockname()[0]
    except OSError:
        return None
    finally:
        probe.close()


DERIVED = {
    "where": lambda: {"career": jobkit.CAREER, "db": jobkit.DB, "resumes": jobkit.RESUMES},
    "help": lambda: {"text": open(HELP, encoding="utf-8").read()},
    "career": career,
    "vocabulary": lambda: {f"{table}.{column}": sorted(jobkit.vocabulary(table, column))
                           for table, column in (("profile", "section"),
                                                 ("search_criteria", "kind"),
                                                 ("projects", "status"))},
}

# The profile: the user's own answers, and the only rows this page may write.
# Everything a job phase decides -- postings, scores, staged forms -- stays
# read-only here, because the invariants that make those writes safe live in
# the phases. A column not named by PRAGMA table_info is not settable, so the
# generated `section` and any column added later are refused by construction.
WRITABLE = {"profile", "education", "employers", "projects", "project_bullets",
            "project_technologies", "project_metrics", "project_links",
            "search_criteria", "search_notes", "facts", "company_limits", "accounts"}


def editable(con, table):
    if table not in WRITABLE:
        raise HTTPException(404, f"{table} is not editable from the dashboard")
    return {r["name"] for r in con.execute(f"PRAGMA table_info({table})")}


def write(table, rowid, values):
    """Insert a row, or update the one at `rowid`. '' means NULL: clearing a
    box is how the user unanswers a field, and unanswered is a hard stop."""
    con = jobkit.connect()
    try:
        named = editable(con, table)
        fields = {k: (v if v != "" else None) for k, v in values.items() if k in named}
        if not fields:
            raise HTTPException(400, f"no writable column among {', '.join(values) or '(none)'}")
        if rowid is None:
            columns = ", ".join(fields)
            cursor = con.execute(f"INSERT INTO {table}({columns})"
                                 f" VALUES({', '.join(':' + k for k in fields)})", fields)
            rowid = cursor.lastrowid
        elif not con.execute(f"UPDATE {table} SET {', '.join(f'{k}=:{k}' for k in fields)}"
                             " WHERE rowid=:rowid", {**fields, "rowid": rowid}).rowcount:
            raise HTTPException(404, f"no row {rowid} in {table}")
        con.commit()
        return {"rowid": rowid}
    finally:
        con.close()


def drop(table, rowid):
    con = jobkit.connect()
    try:
        editable(con, table)
        if not con.execute(f"DELETE FROM {table} WHERE rowid=?", (rowid,)).rowcount:
            raise HTTPException(404, f"no row {rowid} in {table}")
        con.commit()
        return {"deleted": rowid}
    finally:
        con.close()


app = FastAPI(docs_url=None, redoc_url=None)


@app.exception_handler(sqlite3.Error)
@app.exception_handler(OSError)
async def _failed(_request, error):
    # A CHECK the user tripped is their mistake to fix, not a server fault.
    refused = isinstance(error, sqlite3.IntegrityError)
    return JSONResponse({"error": " ".join(str(error).split())},
                        status_code=400 if refused else 500)


@app.middleware("http")
async def gate(request: Request, call_next):
    local = request.client and request.client.host in LOOPBACK
    if ACCESS is not None and not local:
        presented = request.query_params.get("k") or request.cookies.get("job_key") or ""
        if not secrets.compare_digest(presented, ACCESS):
            return JSONResponse(
                {"error": "this dashboard needs its access key — open the ?k= link"},
                status_code=403)
    # A page in some other tab can reach 127.0.0.1 too. Reads it cannot see;
    # a write it must not make, so a request carrying someone else's origin is
    # refused before it gets to one.
    origin = request.headers.get("origin")
    if request.method != "GET" and origin and origin != str(request.base_url).rstrip("/"):
        return JSONResponse({"error": f"refused a write from {origin}"}, status_code=403)
    return await call_next(request)


@app.get("/", response_class=HTMLResponse)
@app.get("/index.html", response_class=HTMLResponse)
def page(request: Request):
    local = request.client and request.client.host in LOOPBACK
    response = HTMLResponse(open(HTML, encoding="utf-8").read(),
                            headers={"Cache-Control": "no-store"})
    if ACCESS is not None and not local:
        response.set_cookie("job_key", ACCESS, max_age=604800, samesite="lax")
    return response


@app.get("/asset/{kind}/{key:path}")
def serve_asset(kind: str, key: str):
    path = asset(kind, key)
    if not path:
        raise HTTPException(404, "no such file")
    return FileResponse(path, headers={
        "Content-Disposition": f'inline; filename="{os.path.basename(path)}"'})


@app.post("/api/edit/{table}")
def api_edit(table: str, body: dict = Body(...)):
    return write(table, body.get("rowid"), body.get("values") or {})


@app.delete("/api/edit/{table}/{rowid}")
def api_drop(table: str, rowid: int):
    return drop(table, rowid)


@app.get("/api/prospect")
def api_prospect(key: str = ""):
    found = prospect(key)
    if not found:
        raise HTTPException(404, f"no prospect {key!r}")
    return found


@app.get("/api/{name}")
def api(name: str):
    if name in DERIVED:
        return DERIVED[name]()
    if name in LISTS:
        return rows(LISTS[name])
    raise HTTPException(404, "no such view")


@app.exception_handler(AnyHTTPException)
async def _http_error(_request, error):
    return JSONResponse({"error": error.detail}, status_code=error.status_code)


def free_port(start, host="127.0.0.1"):
    probe_host = "127.0.0.1" if host in ("0.0.0.0", "") else host
    for port in range(start, start + 20):
        with socket.socket() as probe:
            if probe.connect_ex((probe_host, port)) != 0:
                return port
    sys.exit(f"no free port in {start}-{start + 19}")


def main(port: int = 8765,
         open_browser: bool = typer.Option(True, "--open/--no-open"),
         lan: bool = typer.Option(False, help="answer every device on this network, "
                                              "gated by an access key"),
         host: str = typer.Option(None, help="bind address (implies --lan unless loopback)"),
         key: str = typer.Option(None, help="reuse a fixed access key instead of minting one")):
    """Serve the local dashboard, the one place the profile is edited by hand."""
    if not os.path.exists(jobkit.DB):
        sys.exit(f"no database at {jobkit.DB} — run /job setup first")
    jobkit.connect().close()

    global ACCESS
    host = host or ("0.0.0.0" if lan else "127.0.0.1")
    exposed = host not in LOOPBACK
    if exposed:
        ACCESS = key or secrets.token_urlsafe(16)

    port = free_port(port, host)
    url = f"http://127.0.0.1:{port}/"
    lines = [f"job dashboard  {url}", f"reading        {jobkit.DB}"]
    if exposed:
        address = lan_ip() if host == "0.0.0.0" else host
        lines.append(f"on your phone  http://{address}:{port}/?k={ACCESS}" if address
                     else "on your phone  no network address found for this machine")
        lines.append("               that link is the password — anyone on this network who")
        lines.append("               has it can read your career data")
    lines.append("ctrl-c to stop")
    print("\n".join(lines), flush=True)
    if open_browser:
        threading.Timer(0.4, webbrowser.open, (url,)).start()
    uvicorn.run(app, host=host, port=port, log_level="warning")


def cli():
    typer.run(main)


if __name__ == "__main__":
    cli()
