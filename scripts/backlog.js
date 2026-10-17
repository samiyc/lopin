import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localTimestamp } from "../src/replay/core/log.js";
import { stopReason } from "./lib/domain/backlog-stop.js";
import { applyThreadsOption, workerCount } from "./lib/cli/pool.js";

/**
 * `npm run backlog [-- --list]`: the long jobs kept for the night
 * (data/backlog.json), run one after the other. Each job's output goes to
 * backlog-runs/<date>_<id>.txt (ignored by git) and the job is marked done in
 * the file, with its date and duration, as soon as it ends — so stopping the
 * run (Ctrl+C) only loses the job in progress. `--list` shows the queue.
 *
 * No job runs longer than its `limit` in minutes (`LIMIT`, 2 h, by default:
 * Sami, 03/10), so that a job gone wrong does not eat the night. One that
 * reaches it is stopped, with every process under it, and marked `timeout`.
 *
 * A job `scheduled` with `notBefore` (an ISO date) waits until then: kept for
 * the night, it is not started by a run that goes on into the day.
 *
 * `--list` shows the jobs to come and the last `SHOWN_DONE` finished ones;
 * `--archive` moves the older finished ones (done, failed, timeout) to
 * data/backlog-done.json, the queue's history, once their results are read.
 *
 * `--threads N|max`: every job inherits `LOPIN_THREADS`, the number of worker
 * threads its pools use (scripts/lib/cli/pool.js). Without it, the default: every
 * core but 3, 18 at most (Sami, 07/10), so the machine stays usable.
 *
 * `stopIf` (Sami, 05/10): a job may be cancelled before it starts — marked
 * `skipped`, with its reason — when the duels it names, done, pool under a bar:
 * a series of long duels that started badly stops there (scripts/lib/domain/backlog-stop.js).
 *
 * `--queue laptop`: another machine's own queue, data/backlog-laptop.json,
 * so that two machines never write the same file. Its outputs go to
 * data/runs-laptop/, which git carries back: `git pull`, run, then commit and
 * `git push` (docs/cloud.md).
 */
const LIMIT = 120;
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const queue = args.includes("--queue") ? args[args.indexOf("--queue") + 1] : null;
// The jobs are child processes: they inherit the variable their pools read.
applyThreadsOption(args);
const threads = workerCount();
if (queue !== null && !/^[a-z0-9-]+$/.test(queue)) throw new Error(`File inconnue : « ${queue} »`);
const suffix = queue ? `-${queue}` : "";
const FILE = `${ROOT}data/backlog${suffix}.json`;
const RUNS_DIR = queue ? `data/runs${suffix}/` : "backlog-runs/";
const RUNS = `${ROOT}${RUNS_DIR}`;
const readBacklog = async () => JSON.parse(await readFile(FILE, "utf8"));
const saveBacklog = (backlog) => writeFile(FILE, `${JSON.stringify(backlog, null, 2)}\n`);

/** Stops `child` and everything it started (on Windows the shell's children outlive it otherwise). */
function stopTree(child) {
  if (process.platform === "win32") spawn(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/pid", String(child.pid), "/T", "/F"]);
  else child.kill("SIGTERM");
}

/** Runs `command` in a shell, its output both on screen and in `outFile`; resolves with the exit code, or "timeout". */
function run(command, outFile, minutes) {
  const out = createWriteStream(outFile);
  return new Promise((resolve) => {
    const child = spawn(command, { cwd: ROOT, shell: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      out.write(`
[backlog] arrêté au bout de ${minutes} min
`);
      stopTree(child);
    }, minutes * 60_000);
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        process.stdout.write(chunk);
        out.write(chunk);
      });
    }
    child.on("close", (code) => {
      clearTimeout(timer);
      out.end(() => resolve(timedOut ? "timeout" : code));
    });
  });
}

const statusOf = (code) => {
  if (code === "timeout") return "timeout";
  return code === 0 ? "done" : "failed";
};

/** May `job` start now? A "todo" job always; a "scheduled" one once its `notBefore` has come. */
const ready = (job) => job.status === "todo" || (job.status === "scheduled" && Date.now() >= Date.parse(job.notBefore));

const backlog = await readBacklog();
const pending = backlog.jobs.filter(ready);
const SHOWN_DONE = 3;
const finished = (job) => ["done", "failed", "timeout", "skipped"].includes(job.status);

function lineOf(job) {
  const done = job.doneAt ? " (fait le " + job.doneAt + ", " + job.minutes + " min)" : "";
  const wait = job.status === "scheduled" ? ` (pas avant ${job.notBefore})` : "";
  const why = job.reason ? ` (${job.reason})` : "";
  return `[${job.status}] ${job.id} — ${job.estimate} — ${job.command}${done}${wait}${why}`;
}

if (args.includes("--list")) {
  const older = backlog.jobs.filter(finished).slice(0, -SHOWN_DONE);
  if (older.length > 0) console.log(`(${older.length} traitements finis plus anciens masqués : npm run backlog -- --archive les range dans data/backlog-done.json)`);
  for (const job of backlog.jobs) if (!older.includes(job)) console.log(lineOf(job));
  process.exit(0);
}

if (args.includes("--archive")) {
  const older = backlog.jobs.filter(finished).slice(0, -SHOWN_DONE);
  const ARCHIVE = `${ROOT}data/backlog-done${suffix}.json`;
  const history = await readFile(ARCHIVE, "utf8").then((text) => JSON.parse(text), () => ({ note: "Les traitements de nuit finis et lus, sortis de la file (npm run backlog -- --archive).", jobs: [] }));
  await writeFile(ARCHIVE, `${JSON.stringify({ ...history, jobs: [...history.jobs, ...older] }, null, 2)}
`);
  await saveBacklog({ ...backlog, jobs: backlog.jobs.filter((job) => !older.includes(job)) });
  console.log(`${older.length} traitements finis rangés dans ${ARCHIVE.slice(ROOT.length)}.`);
  process.exit(0);
}
await mkdir(RUNS, { recursive: true });
const onThreads = `, sur ${threads} fils`;
console.log(`${pending.length} traitement(s) à faire${onThreads}.`);
// The next job is read from the file each time: one added while another ran is played too.
const tried = new Set();
const nextJob = async () => (await readBacklog()).jobs.find((job) => ready(job) && !tried.has(job.id));
/** A finished job's output, for `stopIf`: empty when it cannot be read. */
const outputOf = (job) => {
  try {
    return readFileSync(`${ROOT}${job.output}`, "utf8");
  } catch {
    return "";
  }
};

/** Cancels `job` before it starts, when its `stopIf` says so; true if it did. */
async function skipped(job) {
  const fresh = await readBacklog();
  const reason = stopReason(job, fresh.jobs, outputOf);
  if (!reason) return false;
  Object.assign(fresh.jobs.find((candidate) => candidate.id === job.id), { status: "skipped", doneAt: localTimestamp().slice(0, 16), minutes: 0, reason });
  await saveBacklog(fresh);
  console.log(`■ ${job.id} : annulé — ${reason}`);
  return true;
}
for (let job = await nextJob(); job; job = await nextJob()) {
  tried.add(job.id);
  if (await skipped(job)) continue;
  const started = Date.now();
  const stamp = localTimestamp().slice(0, 16).replace(/[:T]/g, "-");
  const output = `${RUNS_DIR}${stamp}_${job.id}.txt`;
  console.log(`\n▶ ${job.id} (${job.estimate}) : ${job.command}`);
  const code = await run(job.command, `${ROOT}${output}`, job.limit ?? LIMIT);
  // Re-read the file: someone may have added jobs while this one ran.
  const fresh = await readBacklog();
  const entry = fresh.jobs.find((candidate) => candidate.id === job.id);
  Object.assign(entry, { status: statusOf(code), doneAt: localTimestamp().slice(0, 16), minutes: Math.round((Date.now() - started) / 60000), output });
  await saveBacklog(fresh);
  console.log(`■ ${job.id} : ${entry.status}, ${entry.minutes} min → ${output}`);
}
