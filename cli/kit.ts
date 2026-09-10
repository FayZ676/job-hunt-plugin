import { Command } from "commander";

import { open } from "../lib/core/db.ts";

export const collect = (value: string, held: string[]) => [...held, value];

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function guard(run: (...args: any[]) => unknown | Promise<unknown>) {
  return async (...args: any[]) => {
    try {
      await run(...args);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  };
}

export function action(name: string, description: string) {
  const program = new Command(name).description(description).option("--db <path>");
  const runs = (run: (...args: any[]) => unknown | Promise<unknown>) =>
    guard((...args: any[]) => {
      open(program.opts().db);
      return run(...args);
    });
  return { program, runs };
}
