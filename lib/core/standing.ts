export const WORKING = "Working";
export const WAITING = "Needs input";
export const DONE = "Finished";

export const STANDINGS = [WORKING, WAITING, DONE] as const;

export type Standing = (typeof STANDINGS)[number];

const DECLARED = [WAITING, DONE] as const;

const mark = (standing: Standing) => `[${standing.toLowerCase()}]`;

const MARK = new RegExp(`\\n*^\\[(${DECLARED.map((one) => one.toLowerCase()).join("|")})\\]\\s*$`, "im");

export const declared = (body: string): { body: string; standing?: Standing } => {
  const found = body.match(MARK);
  if (!found) return { body };
  const said = found[1].toLowerCase();
  const standing = DECLARED.find((one) => one.toLowerCase() === said);
  return { body: body.replace(MARK, "").trim(), standing };
};

export const CLOSING =
  `End every message with its state on its own last line: ${mark(WAITING)} when you are waiting ` +
  `on an answer before the work can go on, ${mark(DONE)} otherwise. The mark is stripped before ` +
  `the message is shown.`;
