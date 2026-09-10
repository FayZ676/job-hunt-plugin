## Referring to a job action in UI

`lib/actions.ts` is the only place an action's command text is built, and the skill's `job/actions`
the only place its description is written.
Render a reference with `Command` (label) or `Actions` (clickable badges) from `components`;
never restyle `/job …` text or retype what an action does.

## Writing Page Copy

Copy is plain and sparing: a badge is its own label, so add words only where the
interface cannot explain itself.

@AGENTS.md
