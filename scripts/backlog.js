import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localTimestamp } from "../src/replay/core/log.js";
import { backlogFiles } from "./lib/domain/backlog-files.js";
import { nextJob as pickNext, planNight } from "./lib/domain/backlog-order.js";
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
 * The file holds only the jobs to come (Sami, 17/10): a finished one (done,
 * failed, timeout, skipped) moves at once to data/backlog-done/, one file per
 * month (scripts/lib/domain/backlog-files.js). `--list` shows the jobs to come
 * and the last `SHOWN_DONE` finished ones; `--archive` moves the finished jobs
 * a hand edit left in the queue (every run does it first too).
 *
 * `--threads N|max`: every job inherits `LOPIN_THREADS`, the number of worker
 * threads its pools use (scripts/lib/cli/pool.js). Without it, the default: every
 * core but 3, 18 at most (Sami, 07/10), so the machine stays usable.
 *
 * `stopIf` (Sami, 05/10): a job may be cancelled before it starts — marked
 * `skipped`, with its reason — when the duels it names, done, pool under a bar:
 * a series of long duels that started badly stops there (scripts/lib/domain/backlog-stop.js).
 *
 * The next job (Sami, 22/10, scripts/lib/domain/backlog-order.js): its prerequisites (`after`, and the
 * duels its `stopIf` reads) finished, then a `due` it would otherwise miss, then Smith's rule on
 * `priority` and `estimate`. `--fifo` keeps the file order. `--list` shows the night so planned.
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
const order = { fifo: args.includes("--fifo") };
if (queue !== null && !/^[a-z0-9-]+$/.test(queue)) throw new Error(`File inconnue : « ${queue} »`);
const suffix = queue ? `-${queue}` : "";
const RUNS_DIR = queue ? `data/runs${suffix}/` : "backlog-runs/";
const RUNS = `${ROOT}${RUNS_DIR}`;
const { readQueue: readBacklog, saveQueue: saveBacklog, readArchive, archiveFinished } = backlogFiles({ suffix });

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


const SHOWN_DONE = 3;

/** What a job's line says beyond its id: priority when not normal, due time, prerequisites. */
const tagsOf = (job) =>
  [job.priority && job.priority !== 2 ? `priorité ${job.priority}` : "", job.due ? `pour ${job.due}` : "", job.after?.length ? `après ${job.after.join(", ")}` : ""]
    .filter(Boolean)
    .map((tag) => ` (${tag})`)
    .join("");

function lineOf(job, note = "") {
  const done = job.doneAt ? " (fait le " + job.doneAt + ", " + job.minutes + " min)" : "";
  const why = job.reason ? ` (${job.reason})` : "";
  return `${note}[${job.status}] ${job.id} — ${job.estimate} — ${job.command}${tagsOf(job)}${done}${why}`;
}

const hhmm = (ms) => new Date(ms).toTimeString().slice(0, 5);

if (args.includes("--list")) {
  const archived = await readArchive();
  if (archived.length > SHOWN_DONE) console.log(`(${archived.length - SHOWN_DONE} traitements finis plus anciens dans data/backlog-done${suffix}/)`);
  for (const job of archived.slice(-SHOWN_DONE)) console.log(lineOf(job));
  const { order: night, waiting } = planNight((await readBacklog()).jobs, archived, Date.now(), order);
  if (night.length > 0) console.log(`Ordre prévu${order.fifo ? " (ordre du fichier)" : ""}, si chaque job tient son estimation :`);
  for (const { job, start, end, late } of night) console.log(lineOf(job, `${hhmm(start)} → ${hhmm(end)}${late ? " EN RETARD" : ""}  `));
  for (const { job, blocked, reason } of waiting) console.log(lineOf(job, `${blocked ? "bloqué" : "attend"} : ${reason}  `));
  process.exit(0);
}

// Finished jobs a hand edit left in the queue go to the archive, before a run as on demand.
const moved = await archiveFinished();
if (args.includes("--archive")) {
  console.log(`${moved} traitement(s) fini(s) rangé(s) dans data/backlog-done${suffix}/.`);
  process.exit(0);
}
const planned = planNight((await readBacklog()).jobs, await readArchive(), Date.now(), order);
await mkdir(RUNS, { recursive: true });
const onThreads = `, sur ${threads} fils`;
console.log(`${planned.order.length} traitement(s) à faire${onThreads}, ${planned.waiting.length} en attente.`);
// The next job is read from the file each time: one added while another ran is played too.
const tried = new Set();
const nextJob = async () => pickNext((await readBacklog()).jobs.filter((job) => !tried.has(job.id)), await readArchive(), Date.now(), order);
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
  // The duels a `stopIf` names are finished, so archived: both places are searched.
  const reason = stopReason(job, [...(await readArchive()), ...fresh.jobs], outputOf);
  if (!reason) return false;
  Object.assign(fresh.jobs.find((candidate) => candidate.id === job.id), { status: "skipped", doneAt: localTimestamp().slice(0, 16), minutes: 0, reason });
  await saveBacklog(fresh);
  await archiveFinished();
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
  await archiveFinished();
  console.log(`■ ${job.id} : ${entry.status}, ${entry.minutes} min → ${output}`);
}
