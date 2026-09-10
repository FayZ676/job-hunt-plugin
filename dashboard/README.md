# Job dashboard

A local web app over the [job skill](../skill/README.md): every opening the skill found, with its
posting, score, resume and staging status; your profile, edited in place; and the skill's actions,
run from the page.

## Requirements

- The job skill, installed and set up. The dashboard reads and writes its database, and depends on
  it as the `job` package at `../skill`.
- The `claude` CLI on `PATH`. Each action runs as `claude -p "/job …"` in the skill's directory, and
  the browser `job-browser` would start is started first for any action that browses.

## Run

```
cd dashboard
npm install
npm run dev
```

Then open `http://127.0.0.1:8765`.

## Usage meter

The meter reads the rate-limit snapshot `statusline.sh` writes into the skill's data directory. To
feed it, make the script Claude Code's status line in `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "/absolute/path/to/dashboard/statusline.sh" }
```

## License

MIT
