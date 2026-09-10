import { db, rows as query } from "./core/db.ts";
import { CARDS, VIEWJOB } from "./core/indeed.ts";
import { type Page, page } from "./core/cdp.ts";
import { TABLES } from "./core/schema.ts";
import { MAX_DESCRIPTION_CHARS, htmlToText } from "./core/text.ts";
import { type Excludes, type Harvested, harvest } from "./search.ts";

const GIVE_UP_AFTER = 5;

const pause = (ms: number) => new Promise((wake) => setTimeout(wake, ms));
const human = () => pause(1800 + Math.random() * 2600);

const say = (line: string) => console.log(`${new Date().toTimeString().slice(0, 8)}  ${line}`);

const undescribed = () =>
  query(
    TABLES.postings.pick({ key: true, company: true, title: true, url: true }),
    "SELECT key, company, title, url FROM postings " +
      "WHERE disposition='kept' AND (description IS NULL OR trim(description)='')",
  );

const stalled = (what: string, url: string) =>
  new Error(
    `${GIVE_UP_AFTER} ${what} in a row came back empty, last at ${url} — Indeed is most likely ` +
      "asking for a person; the tab is open in the browser, answer it there and run again, " +
      "which picks up where this stopped",
  );

async function visit<T>(held: Page, url: string, expression: string): Promise<T | null> {
  for (const wait of [0, 5000]) {
    if (wait) await pause(wait);
    try {
      await held.navigate(url);
      const read = await held.evaluate<T | null>(expression);
      if (read && (!Array.isArray(read) || read.length)) return read;
    } catch (error) {
      say(`  ${url} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

async function driving<T>(run: (held: Page) => Promise<T>): Promise<T> {
  const held = await page();
  try {
    const done = await run(held);
    await held.close();
    return done;
  } catch (error) {
    held.abandon();
    throw error;
  }
}

export const crawl = (queries: string[], excludes: Excludes): Promise<Harvested | null> =>
  !queries.length
    ? Promise.resolve(null)
    : driving(async (held) => {
        const cards: unknown[] = [];
        let empty = 0;
        for (const [n, url] of queries.entries()) {
          const read = await visit<unknown[]>(
            held,
            url,
            `(() => { window.scrollBy(0, 400 + Math.random() * 900);
                      try { return ${CARDS} } catch { return null } })()`,
          );
          cards.push(...(read ?? []));
          say(`query ${n + 1}/${queries.length}: ${read?.length ?? 0} cards — ${url}`);
          empty = read ? 0 : empty + 1;
          if (empty >= GIVE_UP_AFTER) throw stalled("queries", url);
          await human();
        }
        return harvest(cards, excludes);
      });

export async function descriptions(limit: number | null = null) {
  const pending = undescribed();
  const wanted = limit ? pending.slice(0, limit) : pending;
  if (!wanted.length) return { fetched: 0, missing: 0 };

  const attach = db().prepare("UPDATE postings SET description=?, last_fetched=date('now') WHERE key=?");
  const fetched = await driving(async (held) => {
    let done = 0;
    let empty = 0;
    for (const [n, row] of wanted.entries()) {
      const url = row.url ?? VIEWJOB + row.key.split(":")[1];
      const raw = await visit<string>(held, url, "document.querySelector('#jobDescriptionText')?.innerHTML ?? null");
      const text = htmlToText(raw).slice(0, MAX_DESCRIPTION_CHARS);
      if (text) {
        attach.run(text, row.key);
        done += 1;
      }
      say(`description ${n + 1}/${wanted.length}: ${text ? `${text.length} chars` : "EMPTY"} — ${row.company}`);
      empty = text ? 0 : empty + 1;
      if (empty >= GIVE_UP_AFTER) throw stalled("postings", url);
      await human();
    }
    return done;
  });

  return { fetched, missing: undescribed().length };
}
