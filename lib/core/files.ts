import fs from "node:fs";

export function removeFiles(paths: string[], attempts = 1) {
  const deleted: string[] = [];
  const stubborn: string[] = [];
  for (const held of paths) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        fs.unlinkSync(held);
      } catch {
        /* already gone, or coming back */
      }
      if (!fs.existsSync(held)) break;
    }
    (fs.existsSync(held) ? stubborn : deleted).push(held);
  }
  return { deleted, stubborn };
}
