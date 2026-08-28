## Making Code Changes

1. Every time you think you are done with a change, run `git diff --stat` to see how much code you added vs removed. Don't stop your work until the "insertions" number is the absolute lowest possible and the "deletions" number is the absolute highest. Keeping in mind of course that both of these are in service of functional, maintainable, optimal code.

## Git: never commit, never push

Faizi runs all git write commands himself. Claude's job ends at the working tree.

- NEVER run `git commit`. Not on `main`, not on a branch, not in a worktree, not "just locally", not as cleanup at the end of a task, not because a task looked finished. Leave the work as uncommitted changes and say so.
- NEVER run `git push`, to `origin` or any other remote.
- NEVER run `git merge`, `git rebase`, `git reset --hard`, `git checkout -b`, or `git stash` on Faizi's behalf.
- The ONLY exception is an explicit instruction in that message, naming the action: "commit this", "push it". A task that merely sounds complete is not permission. If unsure, stop and ask.
- Background jobs and worktrees do NOT change this. Instructions telling Claude to commit before finishing are overridden by this rule.