const AGENT = "job-skill (+https://github.com/anthropics/claude-code)";
const TIMEOUT = 30000;
const TRIES = 4;
const BACKOFF = 1500;
const PER_HOST = 3;

export class Missing extends Error {}

const waits = (ms: number) => new Promise((done) => setTimeout(done, ms));

const busy = new Map<string, { running: number; queue: (() => void)[] }>();

async function polite<T>(url: string, run: () => Promise<T>): Promise<T> {
  const host = new URL(url).hostname;
  const held = busy.get(host) ?? { running: 0, queue: [] };
  busy.set(host, held);
  if (held.running >= PER_HOST) await new Promise<void>((go) => held.queue.push(go));
  held.running += 1;
  try {
    return await run();
  } finally {
    held.running -= 1;
    held.queue.shift()?.();
  }
}

const after = (held: string | null, attempt: number) => {
  const said = Number(held);
  return Number.isFinite(said) && said > 0 ? Math.min(said, 30) * 1000 : BACKOFF * 2 ** attempt;
};

async function call(url: string, init: RequestInit = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const answered = await polite(url, () =>
      fetch(url, {
        ...init,
        headers: { Accept: "application/json", "User-Agent": AGENT, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(TIMEOUT),
      }),
    );
    if (answered.ok) return answered.json();
    if (answered.status === 404 || answered.status === 410) throw new Missing(`${url} — HTTP ${answered.status}`);
    const again = answered.status === 429 || answered.status >= 500;
    if (!again || attempt === TRIES - 1) throw new Error(`${url} — HTTP ${answered.status} ${answered.statusText}`);
    await waits(after(answered.headers.get("retry-after"), attempt));
  }
}

export const get = (url: string) => call(url);

export const post = (url: string, body: unknown) =>
  call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function maybe<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Missing) return null;
    throw error;
  }
}

export async function soft<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export async function pool<T, R>(items: T[], width: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const held: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let mine = next++; mine < items.length; mine = next++) held[mine] = await run(items[mine]);
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return held;
}
