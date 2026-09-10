# job-hunt

Two products, each complete in its own directory.

| Directory | What it is |
| --------- | ---------- |
| [`skill/`](skill/README.md) | The Claude Code skill — `/job` in your terminal. Needs nothing else. |
| [`dashboard/`](dashboard/README.md) | A local web app over the skill: what it found, your profile, its actions. Needs the skill. |

The skill never imports, starts or mentions the dashboard. The dashboard depends on the skill as the
`job` package, and imports only what `skill/package.json` exports.

## Working on both

```
npm install          # both workspaces
npm run typecheck    # both
```
