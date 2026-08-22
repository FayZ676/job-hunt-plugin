#!/usr/bin/env python3
"""Serve the local dashboard: a read-only window onto the job database.

Read-only is enforced by SQLite, not by discipline -- every request opens the
database with mode=ro, so a bug here cannot corrupt the record. Writes stay
where the invariants live: the skill.

  ui.py                 serve on the first free port from 8765
  ui.py --port 9000     pin the port
  ui.py --no-open       do not open a browser
"""

import argparse
import http.server
import json
import mimetypes
import os
import socket
import sqlite3
import sys
import threading
import urllib.parse
import webbrowser

import jobkit

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui.html")

LISTS = {
    "stats": "SELECT status, n FROM stats",
    "pipeline": "SELECT * FROM triage",
    "review": "SELECT * FROM needs_review",
    "profile": "SELECT field, value, section, notes FROM profile ORDER BY section, field",
    "unanswered": "SELECT field, section FROM unanswered",
    "education": "SELECT degree, institution, finished FROM education",
    "criteria": "SELECT kind, value, weight, note FROM search_criteria ORDER BY kind, seq, value",
    "notes": "SELECT topic, note FROM search_notes ORDER BY topic",
    "facts": "SELECT id, fact FROM facts ORDER BY id",
    "accounts": "SELECT employer, system, portal_url, login_email, password_location, created"
                " FROM accounts ORDER BY employer",
    "limits": "SELECT company, stated FROM company_limits ORDER BY company",
    "companies": "SELECT slug, ats, name, active, source, careers_url, cadence, last_checked, why"
                 " FROM companies ORDER BY ats, name",
    "manual_boards": "SELECT name, slug, cadence, last_checked, careers_url, why FROM manual_boards",
    "filters": "SELECT kind, pattern, note FROM filters ORDER BY kind, pattern",
    "funnel": "SELECT COALESCE(disposition,'pending') AS disposition, COUNT(*) AS n"
              " FROM postings GROUP BY disposition ORDER BY n DESC",
    "sources": "SELECT source, COUNT(*) AS n, SUM(disposition='kept') AS kept"
               " FROM postings GROUP BY source ORDER BY n DESC",
}

BROWSABLE = ("prospects", "postings", "companies", "filters", "events", "aliases",
             "staged", "staged_fields", "profile", "employers", "projects",
             "project_bullets", "project_technologies", "project_metrics",
             "project_links", "education", "search_criteria", "search_notes",
             "facts", "company_limits", "accounts", "settings")

WIDE = {"postings": "key, source, ats, company, title, location, remote, compensation,"
                    " posted_at, sponsored, expired, first_fetched, ingested_on, disposition",
        "prospects": "key, company, title, location, remote, compensation, posted_at,"
                     " first_seen, last_seen, source, ats, score, reason, resume, status"}


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
    found["aliases"] = [r["alias_key"] for r in rows("SELECT alias_key FROM aliases WHERE key=?", (key,))]
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


def dropped(disposition, limit, offset):
    where = "disposition IS NULL" if disposition == "pending" else "disposition=?"
    args = () if disposition == "pending" else (disposition,)
    total = one(f"SELECT COUNT(*) AS n FROM postings WHERE {where}", args)["n"]
    listing = rows(
        f"SELECT key, source, company, title, location, compensation, posted_at, url"
        f" FROM postings WHERE {where} ORDER BY last_fetched DESC, rowid DESC LIMIT ? OFFSET ?",
        (*args, limit, offset))
    return {"total": total, "rows": listing}


def table(name, limit, offset):
    if name not in BROWSABLE:
        return None
    total = one(f"SELECT COUNT(*) AS n FROM {name}")["n"]
    listing = rows(f"SELECT {WIDE.get(name, '*')} FROM {name} LIMIT ? OFFSET ?", (limit, offset))
    return {"total": total, "rows": listing, "columns": list(listing[0]) if listing else []}


def asset(kind, key):
    column = {"resume": "prospects", "screenshot": "staged"}.get(kind)
    if not column:
        return None
    path = one(f"SELECT {kind} AS p FROM {column} WHERE key=?", (key,))
    if not path or not path["p"]:
        return None
    resolved = os.path.realpath(os.path.expanduser(path["p"]))
    if not resolved.startswith(os.path.realpath(jobkit.CAREER) + os.sep):
        return None
    return resolved if os.path.isfile(resolved) else None


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass

    def send(self, body, content_type="application/json; charset=utf-8", status=200):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_file(self, path):
        kind = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as handle:
            body = handle.read()
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'inline; filename="{os.path.basename(path)}"')
        self.end_headers()
        self.wfile.write(body)

    def fail(self, status, message):
        self.send(json.dumps({"error": message}), status=status)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        want = lambda name, fallback: int(query.get(name, [fallback])[0])

        try:
            if route in ("/", "/index.html"):
                with open(HTML, encoding="utf-8") as handle:
                    return self.send(handle.read(), "text/html; charset=utf-8")

            if route == "/api/where":
                return self.send(json.dumps({
                    "career": jobkit.CAREER, "db": jobkit.DB, "resumes": jobkit.RESUMES,
                    "tables": list(BROWSABLE)}))

            if route == "/api/career":
                return self.send(json.dumps(career(), ensure_ascii=False))

            if route == "/api/prospect":
                key = query.get("key", [""])[0]
                found = prospect(key)
                return self.send(json.dumps(found, ensure_ascii=False)) if found \
                    else self.fail(404, f"no prospect {key!r}")

            if route == "/api/dropped":
                return self.send(json.dumps(dropped(query.get("disposition", ["pending"])[0],
                                                    want("limit", 50), want("offset", 0)),
                                            ensure_ascii=False))

            if route == "/api/table":
                found = table(query.get("name", [""])[0], want("limit", 100), want("offset", 0))
                return self.send(json.dumps(found, ensure_ascii=False)) if found \
                    else self.fail(404, "not a browsable table")

            if route.startswith("/api/"):
                sql = LISTS.get(route[5:])
                return self.send(json.dumps(rows(sql), ensure_ascii=False)) if sql \
                    else self.fail(404, "no such view")

            if route.startswith("/asset/"):
                _, _, kind, key = route.split("/", 3)
                path = asset(kind, urllib.parse.unquote(key))
                return self.send_file(path) if path else self.fail(404, "no such file")

            return self.fail(404, "no such route")
        except (sqlite3.Error, OSError) as error:
            self.fail(500, str(error))

    do_HEAD = do_GET


def free_port(start):
    for port in range(start, start + 20):
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) != 0:
                return port
    sys.exit(f"no free port in {start}-{start + 19}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(jobkit.DB):
        sys.exit(f"no database at {jobkit.DB} — run /job setup first")
    jobkit.connect().close()

    port = free_port(args.port)
    url = f"http://127.0.0.1:{port}/"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"job dashboard  {url}\nreading        {jobkit.DB}\nctrl-c to stop", flush=True)
    if not args.no_open:
        threading.Timer(0.4, webbrowser.open, (url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
