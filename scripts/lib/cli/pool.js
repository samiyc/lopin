import os from "node:os";
import { Worker } from "node:worker_threads";

/** The most threads a run takes by default, whatever the machine (Sami, 07/10). */
export const MAX_THREADS = 18;

/**
 * The threads a run takes by default (Sami, 07/10): half the logical cores up
 * to 6, every core but 3 above, 18 at most — the PC stays usable, day and
 * night: 2 → 1, 4 → 2, 6 → 3, 8 → 5, 12 → 9, 24 → 18.
 */
export const defaultThreads = (cores) => (cores <= 6 ? Math.max(1, Math.floor(cores / 2)) : Math.min(MAX_THREADS, cores - 3));

/** `LOPIN_THREADS` read: a number of threads, `max` (every core but one, to go faster or on a server), else the default. */
export function threadsFrom(asked, cores) {
  if (asked === "max") return Math.max(1, cores - 1);
  const count = Number(asked);
  return count > 0 ? Math.floor(count) : defaultThreads(cores);
}

/** How many worker threads to run (docs/cloud.md). */
export const workerCount = () => threadsFrom(process.env.LOPIN_THREADS, os.cpus().length);

/** A script's `--threads N|max`, handed to `LOPIN_THREADS`, which the jobs a script starts inherit too. */
export function applyThreadsOption(args) {
  if (!args.includes("--threads")) return;
  const asked = args[args.indexOf("--threads") + 1];
  const valid = asked === "max" || Number(asked) > 0;
  if (!valid) throw new Error("--threads attend un nombre de fils, ou max");
  process.env.LOPIN_THREADS = asked;
}

/**
 * Runs `tasks` on a pool of worker threads, one task at a time per worker,
 * and resolves with the results in task order — so the output does not
 * depend on which thread finished first.
 *
 * `onResult(result, index)` sees each result as it lands (to write it at
 * once); `shouldStop()`, asked before each new task, lets a long run end on
 * time: the tasks under way finish, the rest are left out (undefined).
 */
export function runPool(workerUrl, tasks, { onProgress = () => {}, onResult = () => {}, shouldStop = () => false } = {}) {
  const threads = Math.max(1, Math.min(tasks.length, workerCount()));
  const results = new Array(tasks.length);
  let next = 0;
  let done = 0;
  let live = 0;
  return new Promise((resolve, reject) => {
    const finish = (worker) => {
      worker.terminate();
      live -= 1;
      if (live === 0) resolve(results);
    };
    const feed = (worker) => {
      if (next >= tasks.length || shouldStop()) return finish(worker);
      const index = next;
      next += 1;
      worker.once("message", (result) => {
        results[index] = result;
        done += 1;
        onResult(result, index);
        onProgress(done, tasks.length);
        feed(worker);
      });
      worker.postMessage(tasks[index]);
      return worker;
    };
    for (let t = 0; t < threads; t += 1) {
      const worker = new Worker(workerUrl);
      live += 1;
      worker.on("error", reject);
      feed(worker);
    }
  });
}
