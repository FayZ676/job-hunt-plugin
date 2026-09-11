import os from "node:os";
import path from "node:path";

export const absolute = (held: string) => path.resolve(held.replace(/^~(?=$|\/)/, os.homedir()));

export const CAREER = absolute(process.env.JOB_CAREER_DIR || "~/data/job");
export const DB = path.join(CAREER, "job.db");
const RESUMES = path.join(CAREER, "resumes");
export const DOWNLOADS = path.join(CAREER, "downloads");
export const SUBMITTED = path.join(RESUMES, "submitted");

export const PATHS = {
  career: CAREER,
  db: DB,
  resumes: RESUMES,
  downloads: DOWNLOADS,
  submitted: SUBMITTED,
};
