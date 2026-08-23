#!/usr/bin/env python3
"""Serve the local dashboard: a read-only window onto the job database.

Read-only is enforced by SQLite, not by discipline -- every request opens the
database with mode=ro, so a bug here cannot corrupt the record. Writes stay
where the invariants live: the skill.

  ui.py                 serve on the first free port from 8765
  ui.py --port 9000     pin the port
  ui.py --no-open       do not open a browser
  ui.py --lan           also answer other devices on this network, key-gated
  ui.py --host 0.0.0.0  pin the bind address

Binding past the loopback mints an access key: every request from another
device must carry it, as ?k= once and as a cookie thereafter. Loopback keeps
its unauthenticated door, so nothing about the local dashboard changes.
"""

import argparse
import http.server
import json
import mimetypes
import os
import secrets
import shlex
import shutil
import socket
import sqlite3
import stat
import subprocess
import sys
import tempfile
import threading
import urllib.parse
import webbrowser

import jobkit

HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui.html")

TOKEN = secrets.token_urlsafe(24)
ACCESS = None
LOOPBACK = ("127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1")
MODES = {"": "/job", "scan": "/job scan", "indeed": "/job indeed"}

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
    "companies": "SELECT slug, ats, name, active, source, careers_url, cadence, last_checked, why"
                 " FROM companies ORDER BY ats, name",
    "manual_boards": "SELECT name, slug, cadence, last_checked, careers_url, why FROM manual_boards",
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


def lan_ip():
    """The address this machine answers to on its own network, if it has one."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 9))
        return probe.getsockname()[0]
    except OSError:
        return None
    finally:
        probe.close()


def claude_binary():
    return shutil.which("claude")


def terminal():
    """The stock terminal for this platform, or whatever is actually installed."""
    if sys.platform == "darwin":
        return "Terminal"
    if sys.platform == "win32":
        return "Windows Terminal" if shutil.which("wt") else "Command Prompt"
    for candidate in ("x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"):
        if shutil.which(candidate):
            return candidate
    return None


def launch(mode):
    """Open a terminal running the skill, so the phases that need a person still
    have one. Nothing here interpolates user input: mode indexes a fixed table."""
    binary = claude_binary()
    if not binary:
        raise RuntimeError("the claude CLI is not on PATH")
    prompt = MODES[mode]
    home = os.path.expanduser("~")

    if sys.platform == "darwin":
        script = os.path.join(tempfile.gettempdir(), "job-run.command")
        with open(script, "w", encoding="utf-8") as handle:
            handle.write("#!/bin/sh\ncd {}\nexec {} {}\n".format(
                shlex.quote(home), shlex.quote(binary), shlex.quote(prompt)))
        os.chmod(script, stat.S_IRWXU)
        subprocess.Popen(["open", "-a", "Terminal", script])
        return "Terminal"

    if sys.platform == "win32":
        if shutil.which("wt"):
            subprocess.Popen(["wt", "-d", home, binary, prompt])
            return "Windows Terminal"
        subprocess.Popen(["cmd", "/c", "start", "", "cmd", "/k", binary, prompt], cwd=home)
        return "Command Prompt"

    name = terminal()
    if not name:
        raise RuntimeError("no terminal emulator found")
    subprocess.Popen([name, "-e", binary, prompt], cwd=home)
    return name


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass

    def local(self):
        return self.client_address[0] in LOOPBACK

    def presented_key(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if query.get("k"):
            return query["k"][0]
        cookies = self.headers.get("Cookie") or ""
        for crumb in cookies.split(";"):
            name, _, value = crumb.strip().partition("=")
            if name == "job_key":
                return urllib.parse.unquote(value)
        return None

    def authorized(self):
        if ACCESS is None or self.local():
            return True
        return secrets.compare_digest(self.presented_key() or "", ACCESS)

    def send(self, body, content_type="application/json; charset=utf-8", status=200,
             cookie=None, fresh=False):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if fresh:
            self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
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

        if not self.authorized():
            return self.fail(403, "this dashboard needs its access key — open the ?k= link")

        try:
            if route in ("/", "/index.html"):
                with open(HTML, encoding="utf-8") as handle:
                    page = handle.read().replace("__RUN_TOKEN__", TOKEN)
                cookie = None
                if ACCESS is not None and not self.local():
                    cookie = f"job_key={urllib.parse.quote(ACCESS)}; Path=/; SameSite=Lax; Max-Age=604800"
                return self.send(page, "text/html; charset=utf-8", cookie=cookie, fresh=True)

            if route == "/api/where":
                return self.send(json.dumps({
                    "career": jobkit.CAREER, "db": jobkit.DB, "resumes": jobkit.RESUMES,
                    "terminal": terminal(), "canRun": bool(claude_binary()),
                    "modes": list(MODES)}))

            if route == "/api/career":
                return self.send(json.dumps(career(), ensure_ascii=False))

            if route == "/api/prospect":
                key = query.get("key", [""])[0]
                found = prospect(key)
                return self.send(json.dumps(found, ensure_ascii=False)) if found \
                    else self.fail(404, f"no prospect {key!r}")

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

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/run":
            return self.fail(404, "no such route")
        if not self.authorized():
            return self.fail(403, "this dashboard needs its access key — open the ?k= link")
        if self.headers.get("X-Job-Token") != TOKEN:
            return self.fail(403, "bad token")
        if self.local() and (self.headers.get("Host") or "").split(":")[0] not in LOOPBACK:
            return self.fail(403, "bad host")
        length = int(self.headers.get("Content-Length") or 0)
        try:
            mode = json.loads(self.rfile.read(length) or "{}").get("mode", "")
        except ValueError:
            return self.fail(400, "bad body")
        if mode not in MODES:
            return self.fail(400, "not a runnable mode")
        try:
            where = launch(mode)
        except (RuntimeError, OSError) as error:
            return self.fail(500, str(error))
        return self.send(json.dumps({"terminal": where, "command": MODES[mode]}))


def free_port(start, host="127.0.0.1"):
    probe_host = "127.0.0.1" if host in ("0.0.0.0", "") else host
    for port in range(start, start + 20):
        with socket.socket() as probe:
            if probe.connect_ex((probe_host, port)) != 0:
                return port
    sys.exit(f"no free port in {start}-{start + 19}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--lan", action="store_true",
                    help="answer every device on this network, gated by an access key")
    ap.add_argument("--host", help="bind address (implies --lan unless it is loopback)")
    ap.add_argument("--key", help="reuse a fixed access key instead of minting one")
    args = ap.parse_args()

    if not os.path.exists(jobkit.DB):
        sys.exit(f"no database at {jobkit.DB} — run /job setup first")
    jobkit.connect().close()

    global ACCESS
    host = args.host or ("0.0.0.0" if args.lan else "127.0.0.1")
    exposed = host not in LOOPBACK
    if exposed:
        ACCESS = args.key or secrets.token_urlsafe(16)

    port = free_port(args.port, host)
    url = f"http://127.0.0.1:{port}/"
    server = http.server.ThreadingHTTPServer((host, port), Handler)
    lines = [f"job dashboard  {url}", f"reading        {jobkit.DB}"]
    if exposed:
        address = lan_ip() if host == "0.0.0.0" else host
        lines.append(f"on your phone  http://{address}:{port}/?k={ACCESS}" if address
                     else "on your phone  no network address found for this machine")
        lines.append("               that link is the password — anyone on this network who")
        lines.append("               has it can read your career data")
    lines.append("ctrl-c to stop")
    print("\n".join(lines), flush=True)
    if not args.no_open:
        threading.Timer(0.4, webbrowser.open, (url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
