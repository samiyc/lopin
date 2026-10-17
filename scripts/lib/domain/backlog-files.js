import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

/**
 * The backlog's two places (Sami, 17/10): data/backlog.json holds only the jobs
 * to come (todo, scheduled); a job is moved to the archive, data/backlog-done/,
 * as soon as it finishes (done, failed, timeout, skipped). The archive is one
 * file per month of `doneAt`, so none nears data/'s 500 KB budget. `suffix`:
 * another machine's queue (`--queue laptop` → backlog-laptop.json, backlog-done-laptop/);
 * `root`: the folder holding data/ (the tests point it elsewhere).
 */
export const FINISHED = Object.freeze(["done", "failed", "timeout", "skipped"]);
export const isFinished = (job) => FINISHED.includes(job.status);

/** The month file a finished job goes to: its `doneAt`'s year and month. */
export const monthOf = (job) => (job.doneAt ?? "undated").slice(0, 7);

const ARCHIVE_NOTE = "Les traitements de nuit finis, sortis de la file dès leur fin (scripts/backlog.js), un fichier par mois de doneAt.";
const writeJson = (url, value) => writeFile(url, `${JSON.stringify(value, null, 2)}\n`);
const readJson = (url, fallback) => readFile(url, "utf8").then((text) => JSON.parse(text), () => fallback);
const key = (job) => `${job.id} ${job.doneAt}`;

export function backlogFiles({ root = new URL("../../../", import.meta.url), suffix = "" } = {}) {
  const queueUrl = new URL(`data/backlog${suffix}.json`, root);
  const archiveUrl = new URL(`data/backlog-done${suffix}/`, root);
  const readQueue = () => readJson(queueUrl, { jobs: [] });
  const saveQueue = (queue) => writeJson(queueUrl, queue);

  /** Every archived job, months in order, each month in the order it was archived. */
  const readArchive = async () => {
    const names = await readdir(archiveUrl).catch(() => []);
    const months = await Promise.all(names.filter((name) => name.endsWith(".json")).sort().map((name) => readJson(new URL(name, archiveUrl), { jobs: [] })));
    return months.flatMap((month) => month.jobs);
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
