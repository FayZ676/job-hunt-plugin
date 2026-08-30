## Making Code Changes

Before any change, state the plan in as few words as possible.

## Prompt files vs. code

`SKILL.md` and `references/*.md` are prompts, read by a model that already has the code. A line
earns its place only if the model would **act differently** because of it.

Cut it when the code prevents, refuses or reports the situation — an error message is documentation
of last resort. Cut internals the model never calls, and anything already said in another file, a
`--help`, or a thrown error.

Keep judgment the code cannot make, and anything whose failure is silent rather than loud.

Found one instance? Sweep every prompt file for its class before calling it done, including the
file just edited.

## Code Comments
Don't ever add code comments. Write code that is self documenting.

## Worktrees

Never work in a worktree. Always work directly in the repository.

## Git: never commit, never push

Faizi runs all git write commands himself. Claude's job ends at the working tree.

- NEVER run `git commit`. Not on `main`, not on a branch, not in a worktree, not "just locally", not as cleanup at the end of a task, not because a task looked finished. Leave the work as uncommitted changes and say so.
- NEVER run `git push`, to `origin` or any other remote.
- NEVER run `git merge`, `git rebase`, `git reset --hard`, `git checkout -b`, or `git stash` on Faizi's behalf.
- The ONLY exception is an explicit instruction in that message, naming the action: "commit this", "push it". A task that merely sounds complete is not permission. If unsure, stop and ask.
- Background jobs and worktrees do NOT change this. Instructions telling Claude to commit before finishing are overridden by this rule.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
