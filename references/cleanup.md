# Cleanup

The argument is what the user wants gone, in their words. Turn it into one condition over
`postings` and hand it to `job-cleanup --where`; `$Q --schema` is what the columns are. **Run with
no argument, ask what to remove** — there is no sensible default for a delete, and a guessed
condition is a guess about what the user is allowed to lose.

**Deleting is not how a posting stops mattering.** The rule chain already labels the old, the
expired and the underpaid, and `job-search dispositions` says which. A row carrying a
`disposition` is doing its job where it sits, and the shortlist never sees it. Cleanup is for
rows the user wants off the disk, not for rows that are merely finished.

## Before --confirm

**Show them the preview and let them say the word.** The run without `--confirm` is the whole
proof they get that the condition means what they said; a delete is not undone by searching
again, and the row comes back with its score, its history and its status gone.

**Never delete what was applied to.** `applied` and `interviewing` are the record that this
skill did its work, and a posting deleted out of them will be found, scored and applied to a
second time. If that is what they asked for, say what it costs and make them ask twice.

**A wide condition earns a copy first** — `job-q --export > somewhere.sql`, and tell them where
it went.

## After

Report what went, in their terms — how many postings, and any resume file left on disk for them
to remove by hand.
