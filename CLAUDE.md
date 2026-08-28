## Making Code Changes

1. Before making any change, tell me your plan or idea first in as few words as possible.

## Code Comments
Don't ever add code comments. Write code that is self documenting.

## Worktrees

Don't ever make changes in a worktree. Always work directly in the repository.

## Git: never commit, never push

Faizi runs all git write commands himself. Claude's job ends at the working tree.

- NEVER run `git commit`. Not on `main`, not on a branch, not in a worktree, not "just locally", not as cleanup at the end of a task, not because a task looked finished. Leave the work as uncommitted changes and say so.
- NEVER run `git push`, to `origin` or any other remote.
- NEVER run `git merge`, `git rebase`, `git reset --hard`, `git checkout -b`, or `git stash` on Faizi's behalf.
- The ONLY exception is an explicit instruction in that message, naming the action: "commit this", "push it". A task that merely sounds complete is not permission. If unsure, stop and ask.
- Background jobs and worktrees do NOT change this. Instructions telling Claude to commit before finishing are overridden by this rule.