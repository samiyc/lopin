import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isFinished } from "../../../src/schedule/order.js";

export { FINISHED, isFinished } from "../../../src/schedule/order.js";

/**
 * The backlog's two places (Sami, 17/10): data/backlog.json holds only the jobs
 * to come (todo, scheduled); a job is moved to the archive, data/backlog-done/,
 * as soon as it finishes (done, failed, timeout, skipped). The archive is one
 * file per month of `doneAt`, so none nears data/'s 500 KB budget. `root`: the
 * folder holding data/ (the tests point it elsewhere).
 *
 * Since 26/10/2026 (Sami: the scheduler in mcts-commun), `npm run backlog` hands
 * the jobs to the machine's queue, and they end in its archive,
 * ~/.mcts-backlog/done/ (`machineHome`, `MCTS_BACKLOG_HOME`): `readArchive` reads
 * lopin's jobs there too, after lopin's own, their output's path absolute
 * (`outputUrl` reads either kind). The laptop's queue (--queue laptop) is gone:
 * mcts-commun's docs/distant.md says how another machine runs a queue now.
 */

/** Where a finished job's output is: relative to lopin's folder (its own runs), or absolute (the machine's). */
export const outputUrl = (job, root = new URL("../../../", import.meta.url)) => (path.isAbsolute(job.output) ? pathToFileURL(job.output) : new URL(job.output, root));

const machineHomeOf = (env = process.env) => env.MCTS_BACKLOG_HOME || path.join(os.homedir(), ".mcts-backlog");
const sameFolder = (a, b) => path.relative(path.resolve(a), path.resolve(b)) === "";

/** The jobs of the machine's archive that ran in lopin's folder `root`, their output's path made absolute. */
async function machineArchive(home, root) {
  const folder = path.join(home, "done");
  const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const months = await Promise.all(names.map((name) => readJson(pathToFileURL(path.join(folder, name)), [])));
  const lopin = fileURLToPath(root);
  return months
    .flat()
    .filter((job) => job.cwd && sameFolder(job.cwd, lopin))
    .map((job) => (job.output ? { ...job, output: path.join(home, job.output) } : job));
}

/** The month file a finished job goes to: its `doneAt`'s year and month. */
export const monthOf = (job) => (job.doneAt ?? "undated").slice(0, 7);

const ARCHIVE_NOTE = "Les traitements de nuit finis, sortis de la file dès leur fin (scripts/backlog.js), un fichier par mois de doneAt.";
const writeJson = (url, value) => writeFile(url, `${JSON.stringify(value, null, 2)}\n`);
const readJson = (url, fallback) => readFile(url, "utf8").then((text) => JSON.parse(text), () => fallback);
const key = (job) => `${job.id} ${job.doneAt}`;

export function backlogFiles({ root = new URL("../../../", import.meta.url), machineHome = machineHomeOf() } = {}) {
  const queueUrl = new URL("data/backlog.json", root);
  const archiveUrl = new URL("data/backlog-done/", root);
  const readQueue = () => readJson(queueUrl, { jobs: [] });
  const saveQueue = (queue) => writeJson(queueUrl, queue);

  /** Every archived job, months in order, each month in the order it was archived; then lopin's in the machine's archive. */
  const readArchive = async () => {
    const names = await readdir(archiveUrl).catch(() => []);
    const months = await Promise.all(names.filter((name) => name.endsWith(".json")).sort().map((name) => readJson(new URL(name, archiveUrl), { jobs: [] })));
    return [...months.flatMap((month) => month.jobs), ...(machineHome ? await machineArchive(machineHome, root) : [])];
  };

  /**
   * Moves the queue's finished jobs to the archive; returns how many moved. The
   * archive is written first: a stop in between leaves a job in both places, and
   * the next move skips one already archived (same id, same `doneAt`).
   */
  const archiveFinished = async () => {
    const queue = await readQueue();
    const finished = queue.jobs.filter(isFinished);
    if (finished.length === 0) return 0;
    await mkdir(archiveUrl, { recursive: true });
    // Grouped by hand: Map.groupBy is not in Node 20.
    const byMonth = new Map();
    for (const job of finished) byMonth.set(monthOf(job), [...(byMonth.get(monthOf(job)) ?? []), job]);
    for (const [month, jobs] of byMonth) {
      const url = new URL(`${month}.json`, archiveUrl);
      const file = await readJson(url, { note: ARCHIVE_NOTE, jobs: [] });
      const known = new Set(file.jobs.map(key));
      await writeJson(url, { ...file, jobs: [...file.jobs, ...jobs.filter((job) => !known.has(key(job)))] });
    }
    await saveQueue({ ...queue, jobs: queue.jobs.filter((job) => !isFinished(job)) });
    return finished.length;
  };

  return { readQueue, saveQueue, readArchive, archiveFinished };
}
