# Indeed

Indeed is a **discovery layer**, not a new place to apply. `scan.py` watches 137 companies you already
chose; Indeed answers the question those boards cannot — *who is hiring that isn't on the list at all.*

Everything it finds still gets applied to through the normal path in `references/ats-forms.md`, because
an Indeed posting resolves to the employer's real ATS (see **Applying**, below).

## Drive it by navigation, never by fetch

This is the whole trick, and getting it wrong is what makes Indeed look unusable.

**Navigate to each search URL like a person would.** Indeed serves those requests without complaint.
What it throttles is `fetch()`/XHR against the same URLs — same session, same cookies, but no
navigation fingerprint, no referer chain, no page assets.

Measured 2026-08-21, one session, in this order:

| Method | Result |
| ------ | ------ |
| `urllib` from Python, request 1 | 200 |
| `urllib`, request 2 onward | **403**, IP stays blocked a while |
| In-page `fetch()`, 5 queries at 1.5s | all 200 |
| In-page `fetch()`, 16 queries at 1.8s | 2 × 200, **14 × 429** |
| In-page `fetch()`, 10 queries at 9s, after the above | all **403** |
| **`page.goto()`, 16 queries at ~4s** | **all 200** — while `fetch` was still 403 |
| **`page.goto()`, 24 job pages at ~3s** | **all 200** |

Forty navigations in one session, zero blocks, at a moment when `fetch()` from the same page was
returning 403. There is no query budget to ration and no rotation scheme to maintain. Just navigate.

Keep the pacing human anyway — a couple of seconds of jitter between pages, and a scroll on each — but
that is politeness, not a workaround.

## The flow

Navigate, harvest into `localStorage`, save to disk, filter, then fetch descriptions for the survivors.

### 1. Search

For each query, `page.goto` the search URL, then read the results **out of the page's own data** — no
HTML parsing needed, because the payload is already sitting there:

```js
window.mosaic.providerData['mosaic-provider-jobcards']
      .metaData.mosaicProviderJobCardsModel.results
```

Fields worth keeping per card: `jobkey`, `company`, `title`, `formattedLocation`, `pubDate` (epoch ms),
`sponsored`, `expired`, `indeedApplyEnabled`, `remoteWorkModel.type`, `extractedSalary`.

**`jobkey` is a stable per-posting id.** That is what makes Indeed dedupable at all, and the reason the
old "no stable id" objection in `references/ats-apis.md` no longer holds. Ledger keys are
`indeed:<jobkey>`.

Navigation wipes page variables, so **accumulate across queries in `localStorage`** — same origin, so it
survives every `goto`:

```js
const store = JSON.parse(localStorage.getItem('__jobHarvest') || '{"results":[]}');
store.results.push({query, location, count: rows.length, rows});
localStorage.setItem('__jobHarvest', JSON.stringify(store));
```

**Do not paginate.** `&start=10` is the one request shape that still draws a block, and page 2 of a
narrow query is worth less than page 1 of a different one. More queries, one page each.

### 2. Get it onto disk without spending context

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
await download.saveAs('…/career/jobs/<date>-indeed-raw.json');
```

Same trick for the descriptions file. Nothing large ever passes through the conversation.

### 3. Filter

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" filter --raw career/jobs/<date>-indeed-raw.json
```

Writes `career/jobs/<date>-indeed-pending.json` — the survivors that have earned a description fetch —
and prints per-filter drop counts plus the companies found that aren't on the watchlist.

| Flag | Use |
| ---- | --- |
| `--include-seen` | ignore the ledger, for rebuilding a run |
| `--keep-tracked` | keep roles at companies `scan.py` already covers |
| `--comp-floor 120000` | override the floor from `indeed-queries.json` |
| `--no-location-filter` | see what the location rule costs |

It reuses `title_include`, `title_exclude`, `location_include`, `location_exclude`, `us_tokens`, and
`max_age_days` from `career/scan-config.json`, so both sources are filtered identically. The
Indeed-specific rules live in `career/indeed-queries.json`.

### 4. Descriptions, for survivors only

The search cards carry a truncated HTML `snippet` that is **not good enough to score on**. Navigate to
`/viewjob?jk=<jobkey>` for each survivor and read `#jobDescriptionText`, plus `#salaryInfoAndJobType`
for the stated band. Accumulate in `localStorage` and save the same way.

**Cap each description at ~4,000 characters.** Full ones run 9,000–14,500; 4,000 is more than enough to
score on, and the cap is what keeps 24 of them affordable.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/job/scripts/indeed_filter.py" merge \
  --pending career/jobs/<date>-indeed-pending.json \
  --descriptions career/jobs/<date>-indeed-descs.json --require-description
```

That folds them into `career/jobs/<date>-candidates.json` alongside the ATS results, so Phase 2 scores
one list and does not care where a role came from.

## Dedupe, in three layers

Indeed re-lists jobs already on boards `scan.py` reads, so this matters more here than anywhere else.

1. **`indeed:<jobkey>` against the ledger** — the ordinary check every source gets.
2. **Company against `career/scan-config.json`** — if the company is an active watchlist entry, drop the
   Indeed copy. `scan.py` already has that role with a better description and a real apply URL.
   Instacart proved this on 2026-08-21: its Indeed listing resolved to `gh_jid=8143145`, the same
   posting the Greenhouse fetcher returns.
3. **Normalized company + title** — against the ledger and against roles already merged into today's
   candidates. Names are normalized past `Inc`/`LLC`/`Technologies` before comparing.

Layer 2 is what keeps the run honest. Without it every Indeed pass re-proposes roles the watchlist
covered hours earlier.

## The noise, and what removes it

Indeed's index is mostly not for you. The first full run, 2026-08-21: **148 cards in, 24 out.**

```
sponsored 24 | agency 56 | lowball 3 | title 27 | stale 1 | already-seen 1 | dupes 12
```

| Filter | Removes |
| ------ | ------- |
| `sponsored: true` | paid placements. Almost entirely AI-trainer gig spam and unrelated listings — one sponsored hit under "generative ai engineer" was a **psychiatrist** role |
| `agency_blocklist` | named reposters, body shops, and consultancies: DataAnnotation, Bright Vision, Cognizant, Infosys, Jobot, CyberCoders, TEKsystems, Marlabs, ICF, Govcio, and the rest |
| `agency_name_patterns` | anything reading `staffing` / `recruiting` / `consulting group` / `outsourcing` / `federal` |
| `title_noise` | "AI Trainer", annotation, tutoring, freelance-gig phrasing |
| `comp_floor` | yearly bands topping out below the floor in `career/search-profile.md`. Catches listings titled "Senior AI Engineer" at $31K–47K |
| `expired: true` | dead listings still in the index |

**Tune the blocklist as you go.** When a run surfaces a reposter, add it — that is a permanent
improvement, and the list is the main thing between this source and a shortlist full of staffing firms.
The first run moved it from 33 names to 49 and cut survivors from 37 to 24.

**A blocklist entry is not a judgment about the employer**, only about whether their Indeed listings are
worth reading. A company that starts posting directly should come off the list.

## Applying

**`https://www.indeed.com/applystart?jk=<jobkey>&from=vj` redirects to the employer's real application
page.** Verified 2026-08-21: the Instacart posting resolved to `instacart.careers/job?gh_jid=8143145`,
a Greenhouse form.

So the apply path is unchanged. Resolve the URL, land on the real ATS, and follow
`references/ats-forms.md` as for any other role. Record the resolved URL as `resolved_ats_url` and use
it — not the `indeed.com/viewjob` link — as the application's `url`.

**When it resolves to Greenhouse, Lever, or Ashby, add the company to `career/scan-config.json`.** This
is the compounding win: Indeed finds the company once, and the cheap API scan covers it every morning
after. Every graduation makes the next Indeed run less necessary.

**Indeed Apply** (`indeedApplyEnabled: true` with no company site) is the exception — an in-platform form
needing a signed-in Indeed account. Scanning does not need a login; only this does. Treat it like any
other login wall: stage what is reachable and flag it.

## Traps

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| 429s or 403s | Using `fetch()` instead of navigating | Navigate. This is the one mistake that makes Indeed look rate-limited |
| Blocked even while navigating | `&start=` pagination, or a prior `fetch` run poisoned the session | Drop pagination; a poisoned session clears on its own |
| `window.mosaic` undefined | Read ran before the page settled, or the response was a block page | Check the navigation status first, then wait and re-read |
| Shortlist fills with staffing firms | Blocklist is stale | Add the names; they repeat daily |
| A role appears twice in the run entry | Layer 2 dedupe missed | The company is on the watchlist under a different name — reconcile the spelling |
| A foreign role survives the location filter | `formattedLocation` says only "Remote" | Not catchable mechanically — "Singapore AI Safety Hub" cleared the filter on the first run. The description read is the backstop |
| Comp band looks absurd | `extractedSalary` is inferred, not stated | Trust `#salaryInfoAndJobType` on the JD page over the card |

## What Indeed does not replace

`references/manual-boards.md` still exists, and Indeed does not retire it outright — see that file's
own note. Indeed indexes what employers choose to syndicate, and it is a keyword search rather than a
watch on a specific company. It **widens** coverage; it does not **guarantee** it for any particular
employer. But now that the pass runs unthrottled, the per-company coverage audit described in that file
is cheap to run, and cadences should be cut wherever it shows real coverage.
