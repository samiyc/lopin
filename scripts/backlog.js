import { execFile, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { backlogFiles } from "./lib/domain/backlog-files.js";
import { applyThreadsOption, threadsFrom, workerCount } from "./lib/cli/pool.js";

/**
 * `npm run backlog [-- …]`: lopin's night jobs, played by the machine's queue (Sami, 26/10/2026: the scheduler in
 * mcts-commun, lopin keeps no runner of its own). `data/backlog.json` stays where the jobs to come are written; this
 * command hands them to mcts-commun's `mcts-backlog`, which runs every project's long jobs side by side within the
 * machine's threads, with the heat and memory guards (mcts-commun's README and docs/backlog.md).
 *
 *   npm run backlog                  data/backlog.json's jobs go to the machine's queue, then the queue is played,
 *                                    unless a runner already plays it (it takes them on its own)
 *   npm run backlog -- --list        the machine's queue; --tui, --status ID, --wait ID, --cancel ID, --retry ID too
 *   npm run backlog -- --threads N   the threads of the jobs that do not say theirs (every core but 3, 18 at most)
 *
 * A job keeps its id, `after`, `due`, `priority`, `limit` (120 min by default), `notBefore`; its `threads` are counted
 * in the machine's slots (a duel takes all it is lent). Its `stopIf` stays: mcts-backlog orders by it as lopin did,
 * and asks `node scripts/stop-check.js ID` before the job starts (its `skipIf`). The outputs go to
 * ~/.mcts-backlog/runs/, the finished jobs to ~/.mcts-backlog/done/, which `backlogFiles().readArchive()` reads with
 * lopin's own archive (data/backlog-done/). Once handed over, data/backlog.json is left empty.
 */
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BACKLOG = fileURLToPath(new URL("../node_modules/mcts-commun/bin/backlog.js", import.meta.url));
const FORWARDED = ["--list", "--json", "--tui", "--status", "--wait", "--cancel", "--retry"];
const LIMIT = 120;
const TMP = new URL("../tmp/", import.meta.url);
const args = process.argv.slice(2);

/** mcts-backlog with `flags`, on this terminal; resolves with its exit code. */
const backlog = (flags) => new Promise((resolve) => spawn(process.execPath, [BACKLOG, ...flags], { stdio: "inherit" }).on("exit", resolve));

/** A job of data/backlog.json as the machine's queue takes it. */
function machineJob(job, threads) {
  const own = job.threads ? threadsFrom(String(job.threads), os.cpus().length) : threads;
  const skipIf = job.stopIf?.length ? { skipIf: `node scripts/stop-check.js ${job.id}` } : {};
  return { ...job, cwd: ROOT, threads: own, limit: job.limit ?? LIMIT, ...skipIf };
}

/** The runners alive on the machine, from mcts-backlog's view. */
async function runners() {
  const { stdout } = await promisify(execFile)(process.execPath, [BACKLOG, "--list", "--json"], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout).runners.filter((runner) => runner.alive);
}

/** Hands data/backlog.json's jobs to the machine's queue: how many. */
async function handOver(threads) {
  const files = backlogFiles();
  await files.archiveFinished();
  const queue = await files.readQueue();
  if (queue.jobs.length === 0) return 0;
  await mkdir(TMP, { recursive: true });
  const file = fileURLToPath(new URL("backlog-to-machine.json", TMP));
  await writeFile(file, JSON.stringify({ jobs: queue.jobs.map((job) => machineJob(job, threads)) }, null, 2));
  if ((await backlog(["--add-file", file, "--no-tag"])) !== 0) throw new Error("la file de la machine a refusé ces jobs : data/backlog.json est laissé tel quel");
  await files.saveQueue({ ...queue, jobs: [] });
  return queue.jobs.length;
}

if (FORWARDED.some((flag) => args.includes(flag))) process.exit(await backlog(args));
applyThreadsOption(args);
const handed = await handOver(workerCount());
console.log(`${handed} job(s) de data/backlog.json versé(s) dans la file de la machine (mcts-backlog).`);
const alive = await runners();
if (alive.length > 0) {
  console.log(`Un lanceur tourne déjà (pid ${alive.map((runner) => runner.pid).join(", ")}) : il prend ces jobs. npm run backlog -- --list pour les suivre.`);
  process.exit(0);
}
process.exit(await backlog([]));
