#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { ACTIONS } from "../lib/core/actions.ts";

const ELSEWHERE = [
  {
    id: "ui",
    argument: "",
    does: "serve the dashboard on 127.0.0.1:8765; run the actions and edit your profile there",
  },
  { id: "help", argument: "", does: "this message" },
];

const NOTES = [
  "run `/job setup` first — every other command is a no-op until $CAREER exists",
  "nothing is submitted without your approval, named by you, in that run",
  "a field your profile does not answer is left empty and reported, never guessed",
  "everything lives in $CAREER/job.db (default ~/data/job, JOB_CAREER_DIR overrides)",
  "searching costs Apify credit, billed per job returned — ruling again is free",
  "ask about your search in plain English — it is answered with a query",
];

const called = ({ id, argument }: { id: string; argument: string }) =>
  id === "all" ? "(none)" : argument ? `${id} ${argument}` : id;

const commands = [...ACTIONS, ...ELSEWHERE];
const width = Math.max(...commands.map((command) => called(command).length));

console.log(`job — search every company career site, score the openings, tailor a resume,
      stage the application, and submit what you approve.

usage: /job [command] [argument]

commands:`);
for (const command of commands) console.log(`  ${called(command).padEnd(width)}    ${command.does}`);

console.log("\nnotes:");
for (const note of NOTES) console.log(`  ${note}`);
