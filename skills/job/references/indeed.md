# Indeed

A **discovery layer**, not a new place to apply. The board fetch watches companies already chosen;
Indeed answers what those boards cannot — *who is hiring that isn't on the list at all.*

**Indeed is not a special case.** It is one source among several, and it differs in exactly one
respect: a browser has to collect its postings, because Indeed throttles `fetch()` but not
navigation. Once `fetch.py harvest` has read what the browser saved, an Indeed row is a posting like
any other — same table, same filters, same ingest, same applying path.

## Navigate, never fetch

This is the whole trick, and getting it wrong is what makes Indeed look unusable.

**Navigate to each search URL like a person would.** Indeed serves those requests without complaint.
What it throttles is `fetch()`/XHR against the same URLs — same session, same cookies, but no
navigation fingerprint, no referer chain, no page assets. Measured in one session, 2026-08-21:
`urllib` blocked at request 2; in-page `fetch()` at 1.8s intervals returned 14 × 429 out of 16; and
`page.goto()` returned 200 on all 40 navigations *while `fetch` from the same page was still 403*.

There is no query budget to ration and no rotation scheme to maintain. Keep the pacing human anyway —
a couple of seconds of jitter and a scroll per page — but that is politeness, not a workaround.

## The flow

### 1. Search

For each query, `page.goto` the search URL, then read the results out of the page's own data — no
HTML parsing, because the payload is already there:

```js
window.mosaic.providerData['mosaic-provider-jobcards']
      .metaData.mosaicProviderJobCardsModel.results
```

Keep per card: `jobkey`, `company`, `title`, `formattedLocation`, `pubDate` (epoch ms), `sponsored`,
`expired`, `indeedApplyEnabled`, `remoteWorkModel.type`, `extractedSalary`. **`jobkey` is a stable
per-posting id** — that is what makes Indeed dedupable at all. Prospect keys are `indeed:<jobkey>`.

Navigation wipes page variables, so **accumulate across queries in `localStorage`** — same origin, so
it survives every `goto`:

```js
const store = JSON.parse(localStorage.getItem('__jobHarvest') || '{"results":[]}');
store.results.push({query, location, rows});
localStorage.setItem('__jobHarvest', JSON.stringify(store));
```

**Do not paginate.** `&start=10` is the one request shape that still draws a block, and page 2 of a
narrow query is worth less than page 1 of a different one. More queries, one page each.

### 2. Onto disk without spending context

The harvest is ~90KB. Do not read it through the model to write it out. The Playwright process has no
filesystem access, but a blob download does:

```js
const [download] = await Promise.all([
  page.waitForEvent('download', {timeout: 20000}),
  page.evaluate(() => {
    const blob = new Blob([localStorage.getItem('__jobHarvest')], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'indeed-raw.json';
    document.body.appendChild(a); a.click();
  })
]);
await download.saveAs('…/indeed-raw.json');
```

Same trick for the descriptions file. Nothing large ever passes through the conversation.

### 3. Load it into the raw layer

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/fetch.py" harvest --source indeed --file <harvest.json>
```

Parses the harvest into `postings`, normalized and unjudged — including the facts only Indeed states,
like whether a card is `sponsored` or `expired`, and the salary band it extracted. Nothing is
filtered here.

### 4. Ingest

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/ingest.py"
```

The same pass that rules on board postings. There is no Indeed-specific filter and no Indeed-specific
flag — see `references/boards.md` for the full list. Two of them matter most here: `--keep-covered`
keeps roles at companies a board already covers, and `--redo` re-rules the stored harvest after a
blocklist change, with no second visit to Indeed.

### 5. Descriptions, for survivors only

The search cards carry a truncated `snippet` that is **not good enough to score on**. Navigate to
`/viewjob?jk=<jobkey>` for each survivor, read `#jobDescriptionText` plus `#salaryInfoAndJobType`,
accumulate in `localStorage`, and save the same way. **Cap each at ~4,000 characters** — full ones
run 9,000–14,500, and the cap is what keeps two dozen of them affordable.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/fetch.py" descriptions --file <descs.json>
```

Attaches them to the rows ingest kept and warns about any prospect still without one. Phase 2 then
scores one list and does not care where a role came from.

## Dedupe

Indeed re-lists jobs the boards already carry, so this matters more here than anywhere else — but
none of it is Indeed-specific logic. Ingest applies the same three checks to every source:

1. **The key**, against `prospects` and `aliases`.
2. **Source precedence** — a company whose own board is watched outranks an aggregator's copy of it,
   which is dropped as `covered`. Without this, every pass re-proposes roles the boards covered hours
   earlier. When the board copy arrives *after* the aggregator's, the prospect is **upgraded** in
   place instead: same key and history, real description and apply URL.
3. **Normalized company + title**, with names normalized past `Inc`/`LLC`/`Technologies`. Same-run
   collisions merge, keeping the better-ranked source and both locations.

## The noise

Indeed's index is mostly not for you: the first full run took **148 cards in, 24 out.**

These are ordinary filters that happen to fire most often here; each applies to every source, and
does nothing on a source that never states the fact.

| Filter | Removes |
| ------ | ------- |
| `sponsored` | paid placements — almost entirely AI-trainer gig spam and unrelated listings |
| `agency_blocklist` | named reposters, body shops and consultancies |
| `agency_name_patterns` | anything reading `staffing` / `recruiting` / `consulting group` / `outsourcing` / `federal` |
| `title_noise` | "AI Trainer", annotation, tutoring, freelance-gig phrasing |
| `comp_floor` | yearly bands topping out below the floor — catches "Senior AI Engineer" at $31K–47K |
| `expired` | dead listings still in the index — an unlisted Ashby posting trips the same filter |

**Tune the blocklist as you go.** When a run surfaces a reposter, add it — that is a permanent
improvement, and the list is the main thing between this source and a shortlist full of staffing
firms. A blocklist entry is not a judgment about the employer, only about whether their Indeed
listings are worth reading; a company that starts posting directly should come off it.

## Applying

**`https://www.indeed.com/applystart?jk=<jobkey>&from=vj` redirects to the employer's real
application page.** Resolve it, land on the real ATS, and follow `references/applying.md` as for any
other role. Record the resolved URL as the application's `url` — never the `viewjob` link.

**When it resolves to Greenhouse, Lever or Ashby, `INSERT` it into `companies`.** This is the
compounding win: Indeed finds the company once, and the cheap board fetch covers it every morning
after — at which point ingest upgrades the prospect to the board's copy on its own.

**Indeed Apply** (`indeedApplyEnabled: true` with no company site) is the exception — an in-platform
form needing a signed-in account. Treat it like any other login wall: stage what is reachable, flag
the rest.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| 429s or 403s | Using `fetch()` instead of navigating | Navigate. This is the one mistake that makes Indeed look rate-limited |
| Blocked even while navigating | `&start=` pagination, or a prior `fetch` run poisoned the session | Drop pagination; a poisoned session clears on its own |
| `window.mosaic` undefined | Read ran before the page settled, or the response was a block page | Check the navigation status, then wait and re-read |
| Shortlist fills with staffing firms | Blocklist is stale | Add the names; they repeat daily |
| A role appears twice | Layer 2 dedupe missed | The company is on the watchlist under a different name — reconcile the spelling |
| A foreign role survives the location filter | `formattedLocation` says only "Remote" | Not catchable mechanically; the description read is the backstop |
| Comp band looks absurd | `extractedSalary` is inferred, not stated | Trust `#salaryInfoAndJobType` on the JD page over the card |
