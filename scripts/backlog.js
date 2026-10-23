import { readFileSync } from "node:fs";
import os from "node:os";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { localTimestamp } from "../src/replay/core/log.js";
import { backlogFiles } from "./lib/domain/backlog-files.js";
import { nextJob as pickNext, planNight } from "../src/schedule/order.js";
import { stopReason } from "../src/schedule/stop.js";
import { applyThreadsOption, threadsFrom, workerCount } from "./lib/cli/pool.js";
import { heatSettings, readCpuTemperature, waitUntilCool, watchHeat } from "./lib/cli/machine.js";
import { runCommand } from "./lib/cli/run-command.js";
import { appendJobLog, jobLine, memoryFloorGb, watchMemory } from "./lib/domain/job-log.js";

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
 * a series of long duels that started badly stops there (src/schedule/stop.js).
 *
 * The next job (Sami, 22/10, src/schedule/order.js): its prerequisites (`after`, and the
 * duels its `stopIf` reads) finished, then a `due` it would otherwise miss, then Smith's rule on
 * `priority` and `estimate`. `--fifo` keeps the file order. `--list` shows the night so planned.
 *
 * A job may carry `threads`: its own `LOPIN_THREADS`, over `--threads`. Every job writes its line to
 * the job log (scripts/lib/domain/job-log.js, data/job-log/): kind, engines, threads, minutes, games,
 * free memory at its lowest, the CPU's temperature.
 *
 * The heat guard (Sami, 22/10, scripts/lib/cli/machine.js, docs/ismcts-ailleurs/backlog.md § 9.8): with
 * LibreHardwareMonitor's web server running, the CPU's temperature is read every 30 s; at 90 °C twice in a
 * row the job is stopped, left in the queue, and the queue goes on once the CPU is back under 75 °C. A job
 * stopped `HEAT_STOPS` times ends `failed`. Without the server the run says so and goes on unguarded.
 *
 * The memory guard (Sami, 23/10): the free memory is read every 5 s; under `LOPIN_RAM_FLOOR` GB (5 by
 * default, 0 turns it off) twice in a row, the job is stopped and ends `failed` at once, with its reason: run
 * again, it would fill the memory again. The queue goes on with the next job.
 *
 * `--queue laptop`: another machine's own queue, data/backlog-laptop.json,
 * so that two machines never write the same file. Its outputs go to
 * data/runs-laptop/, which git carries back: `git pull`, run, then commit and
 * `git push` (docs/cloud.md).
 */
const LIMIT = 120;
const HEAT_STOPS = 3;
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

const heat = heatSettings();
const ramFloor = memoryFloorGb();
const heatStops = new Map();

/** A job's threads: its own `threads`, else the run's. */
const threadsOf = (job) => (job.threads ? threadsFrom(String(job.threads), os.cpus().length) : threads);

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
console.log(heatLine(await readCpuTemperature(heat)));
console.log(ramFloor > 0 ? `Garde mémoire : un job s'arrête sous ${ramFloor} Go de RAM libre (${(os.freemem() / 1024 ** 3).toFixed(1).replace(".", ",")} Go libres maintenant).` : "Garde mémoire coupée.");
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
/** 77.9 → « 77,9 °C ». A declaration, hoisted: the run's first line reads it before this point. */
function degrees(celsius) {
  return `${String(celsius).replace(".", ",")} °C`;
}

/** What the run says of its heat guard, from a first reading. */
function heatLine(reading) {
  if (!reading) return "Température du CPU illisible (le serveur web de LibreHardwareMonitor, docs/ismcts-ailleurs/backlog.md § 9.8) : pas de garde thermique.";
  const now = `CPU à ${degrees(reading.celsius)} (${reading.sensor})`;
  return heat.alert > 0 ? `Garde thermique : ${now}, alerte à ${heat.alert} °C sur deux lectures, reprise sous ${heat.resume} °C.` : `${now}, garde thermique coupée.`;
}

/** After the heat guard stopped `job`: true when it goes back to the queue once the CPU has cooled, false once stopped too often. */
async function heatStopped(job, line) {
  const count = (heatStops.get(job.id) ?? 0) + 1;
  heatStops.set(job.id, count);
  if (count >= HEAT_STOPS) return false;
  await appendJobLog(jobLine({ ...line, status: "heat" }));
  console.log(`■ ${job.id} : arrêté par la garde thermique (${count}/${HEAT_STOPS}), CPU jusqu'à ${degrees(line.temperature.cpuMaxC)} ; reprise sous ${heat.resume} °C`);
  const reading = await waitUntilCool({ settings: heat });
  console.log(`  CPU à ${reading ? degrees(reading.celsius) : "? °C"} : la file repart`);
  tried.delete(job.id);
  return true;
}

for (let job = await nextJob(); job; job = await nextJob()) {
  tried.add(job.id);
  if (await skipped(job)) continue;
  const started = Date.now();
  const stamp = localTimestamp().slice(0, 16).replace(/[:T]/g, "-");
  const output = `${RUNS_DIR}${stamp}_${job.id}.txt`;
  console.log(`\n▶ ${job.id} (${job.estimate}) : ${job.command}`);
  const guard = new AbortController();
  let memoryStop = null;
  const memory = watchMemory({
    floorGb: ramFloor,
    onLow: (gb) => {
      memoryStop = `arrêté par la garde mémoire : ${String(gb).replace(".", ",")} Go libres, sous ${ramFloor} Go`;
      guard.abort(memoryStop);
    },
  });
  const temperature = watchHeat({ settings: heat, onAlert: (celsius) => guard.abort(`garde thermique, CPU à ${degrees(celsius)}`) });
  const env = job.threads ? { LOPIN_THREADS: String(job.threads) } : {};
  const code = await runCommand(job.command, { outFile: `${ROOT}${output}`, minutes: job.limit ?? LIMIT, env, signal: guard.signal });
  const run = { id: job.id, command: job.command, threads: threadsOf(job), started: new Date(started), ended: new Date(), output: outputOf({ output }), memory: memory.stop(), temperature: temperature.stop(), source: "backlog", queue: queue ?? "" };
  if (code === "aborted" && !memoryStop && (await heatStopped(job, run))) continue;
  // Re-read the file: someone may have added jobs while this one ran.
  const fresh = await readBacklog();
  const entry = fresh.jobs.find((candidate) => candidate.id === job.id);
  Object.assign(entry, { status: statusOf(code), doneAt: localTimestamp().slice(0, 16), minutes: Math.round((Date.now() - started) / 60000), output });
  if (code === "aborted") entry.reason = memoryStop ?? `arrêté ${HEAT_STOPS} fois par la garde thermique`;
  await saveBacklog(fresh);
  await archiveFinished();
  console.log(`■ ${job.id} : ${entry.status}, ${entry.minutes} min → ${output}`);
  await appendJobLog(jobLine({ ...run, status: entry.status }));
}
