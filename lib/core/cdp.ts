import { ENDPOINT, ensure } from "./browser.ts";

type Message = { id?: number; method?: string; params?: any; result?: any; error?: { message: string } };

export type Page = {
  navigate: (url: string) => Promise<void>;
  evaluate: <T>(expression: string) => Promise<T>;
  abandon: () => void;
  close: () => Promise<void>;
};

async function target(): Promise<{ id: string; ws: string }> {
  const made = await fetch(`${ENDPOINT}/json/new?about:blank`, { method: "PUT" });
  if (!made.ok) throw new Error(`browser refused a new tab: ${made.status} ${await made.text()}`);
  const held = (await made.json()) as { id: string; webSocketDebuggerUrl: string };
  return { id: held.id, ws: held.webSocketDebuggerUrl };
}

async function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  await new Promise<void>((done, stop) => {
    socket.addEventListener("open", () => done(), { once: true });
    socket.addEventListener("error", () => stop(new Error(`no CDP socket at ${url}`)), { once: true });
  });
  return socket;
}

export async function page(): Promise<Page> {
  await ensure();
  const { id, ws } = await target();
  const socket = await connect(ws);

  let last = 0;
  const waiting = new Map<number, { done: (value: any) => void; stop: (error: Error) => void }>();
  const events = new Map<string, (() => void)[]>();

  socket.addEventListener("message", (held) => {
    const said = JSON.parse(String(held.data)) as Message;
    if (said.id !== undefined) {
      const pending = waiting.get(said.id);
      waiting.delete(said.id);
      if (!pending) return;
      if (said.error) pending.stop(new Error(said.error.message));
      else pending.done(said.result);
      return;
    }
    if (!said.method) return;
    for (const wake of events.get(said.method) ?? []) wake();
    events.delete(said.method);
  });

  const send = (method: string, params: unknown = {}) =>
    new Promise<any>((done, stop) => {
      const id = ++last;
      waiting.set(id, { done, stop });
      socket.send(JSON.stringify({ id, method, params }));
    });

  const awaits = (method: string, ms: number) =>
    new Promise<void>((done, stop) => {
      const timer = setTimeout(() => stop(new Error(`${method} never fired within ${ms}ms`)), ms);
      events.set(method, [...(events.get(method) ?? []), () => (clearTimeout(timer), done())]);
    });

  await send("Page.enable");
  await send("Runtime.enable");

  const evaluate = async <T>(expression: string): Promise<T> => {
    const held = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (held.exceptionDetails)
      throw new Error(held.exceptionDetails.exception?.description ?? held.exceptionDetails.text);
    return held.result?.value as T;
  };

  return {
    async navigate(url: string) {
      const loaded = awaits("Page.loadEventFired", 45000);
      const held = await send("Page.navigate", { url });
      if (held.errorText) throw new Error(`${url} would not load: ${held.errorText}`);
      await loaded;
    },
    evaluate,
    abandon() {
      socket.close();
    },
    async close() {
      socket.close();
      await fetch(`${ENDPOINT}/json/close/${id}`).catch(() => {});
    },
  };
}
