"""Serve the local dashboard: a read-only window onto the job database.

  job-ui                 serve on the first free port from 8765
  job-ui --port 9000     pin the port
  job-ui --no-open       do not open a browser
  job-ui --lan           also answer other devices on this network, key-gated
  job-ui --host 0.0.0.0  pin the bind address

Binding past the loopback mints an access key: another device must carry it,
as ?k= once and as a cookie thereafter.
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
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from starlette.exceptions import HTTPException as AnyHTTPException

from jobhunt import jobkit

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui.html")
HELP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "help.txt")

ACCESS = None
LOOPBACK = ("127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1")

LISTS = {
    "stats": "SELECT status, n FROM stats",
    "jobs": "SELECT * FROM triage",
    "profile": "SELECT field, value, section, notes FROM profile ORDER BY section, field",
    "unanswered": "SELECT field, section FROM unanswered",
    "education": "SELECT degree, institution, finished FROM education",
    "criteria": "SELECT kind, value, weight, note FROM search_criteria ORDER BY kind, seq, value",
    "notes": "SELECT topic, note FROM search_notes ORDER BY topic",
    "facts": "SELECT id, fact FROM facts ORDER BY id",
    "accounts": "SELECT employer, system, portal_url, login_email, password_location, created"
                " FROM accounts ORDER BY employer",
    "limits": "SELECT company, stated FROM company_limits ORDER BY company",
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
    employers = rows("SELECT id, name, title, start, finish, current, context FROM employers ORDER BY seq, id")
    projects = rows("SELECT id, employer_id, name, start, finish, status, summary, shared_with, notes"
                    " FROM projects ORDER BY seq, id")
    bullets = rows("SELECT project_id, text FROM project_bullets ORDER BY project_id, seq, rowid")
    tech = rows("SELECT project_id, technology FROM project_technologies ORDER BY project_id, technology")
    metrics = rows("SELECT project_id, metric FROM project_metrics ORDER BY project_id, rowid")
    links = rows("SELECT project_id, label, url FROM project_links ORDER BY project_id, rowid")
    for project in projects:
        pid = project["id"]
        project["bullets"] = [r["text"] for r in bullets if r["project_id"] == pid]
        project["technologies"] = [r["technology"] for r in tech if r["project_id"] == pid]
        project["metrics"] = [r["metric"] for r in metrics if r["project_id"] == pid]
        project["links"] = [r for r in links if r["project_id"] == pid]
    for employer in employers:
        employer["projects"] = [p for p in projects if p["employer_id"] == employer["id"]]
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
}

app = FastAPI(docs_url=None, redoc_url=None)


@app.exception_handler(sqlite3.Error)
@app.exception_handler(OSError)
async def _failed(_request, error):
    return JSONResponse({"error": str(error)}, status_code=500)


@app.middleware("http")
async def gate(request: Request, call_next):
    local = request.client and request.client.host in LOOPBACK
    if ACCESS is not None and not local:
        presented = request.query_params.get("k") or request.cookies.get("job_key") or ""
        if not secrets.compare_digest(presented, ACCESS):
            return JSONResponse(
                {"error": "this dashboard needs its access key — open the ?k= link"},
                status_code=403)
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
    """Serve the local dashboard: a read-only window onto the job database."""
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
