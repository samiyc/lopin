import os from "node:os";
import { fileURLToPath } from "node:url";
import { threadsFrom } from "../cli/pool.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const LIMIT = 120;

/**
 * The fewest threads a job of `threads` starts on, when fewer are free (Sami, 31/10/2026, mcts-backlog's
 * `--min-threads`: a pool reads the threads it got from `MCTS_THREADS`): two thirds, so a duel lasts at most half as
 * long again, under its `limit`.
 */
export const minThreadsOf = (threads) => Math.max(1, Math.ceil((2 * threads) / 3));

/**
 * A job of data/backlog.json as the machine's queue takes it: lopin's folder, its threads (its own, else `threads`),
 * the fewest it starts on, 120 min at most, and `scripts/stop-check.js` as its `skipIf` when it has a `stopIf`.
 */
export function machineJob(job, threads) {
  const own = job.threads ? threadsFrom(String(job.threads), os.cpus().length) : threads;
  const skipIf = job.stopIf?.length ? { skipIf: `node scripts/stop-check.js ${job.id}` } : {};
  return { ...job, cwd: ROOT, threads: own, minThreads: job.minThreads ?? minThreadsOf(own), limit: job.limit ?? LIMIT, ...skipIf };
}
