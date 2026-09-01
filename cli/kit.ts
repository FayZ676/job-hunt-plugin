import { open } from "../lib/core/db.ts";

export const collect = (value: string, held: string[]) => [...held, value];

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export const boot = (options: { db?: string }) => open(options.db ?? null);

export function guard(run: (...args: any[]) => unknown | Promise<unknown>) {
  return async (...args: any[]) => {
    try {
      await run(...args);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  };
}
