import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import os from "node:os";

/**
 * The job log (Sami, 22/10, docs/ismcts-ailleurs/backlog.md § 8): one line per job, by day or by night,
 * from the backlog (`source: "backlog"`), `npm run job` (`"job"`, a job started by hand) or a bench.
 * What the history lacked to learn a thread count per kind of job: the kind, the engines, the threads
 * asked, the minutes, the games played, the free memory at its lowest, and the CPU's temperature at the
 * start and at its highest when LibreHardwareMonitor serves it (scripts/lib/cli/machine.js). One file per month,
 * data/job-log/YYYY-MM.jsonl, so none nears data/'s 500 KB.
 */
const GB = 1024 ** 3;
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

const KINDS = [
  ["duel", /npm run duel\b/],
  ["versus", /npm run versus\b/],
  ["oracle", /npm run oracle\b/],
  ["banc", /npm run banc\b/],
  ["build", /npm run build\b/],
  ["selfplay", /npm run selfplay\b/],
  ["analysis", /scripts[/\\]archive[/\\]/],
];

/** The kind of a job, read from its command: duel, versus, oracle, banc, build, selfplay, analysis or other. */
export function jobKind(command) {
  return KINDS.find(([, pattern]) => pattern.test(command))?.[0] ?? "other";
}

/** A duel's two engines (the first two arguments after `duel --` that are not flags), or null. */
export function enginesOf(command) {
  const rest = /npm run duel -- (.*)$/.exec(command)?.[1];
  if (!rest) return null;
  const words = rest.match(/"[^"]*"|\S+/g) ?? [];
  const engines = words.filter((word) => !word.startsWith("--") && !/^\d+$/.test(word)).slice(0, 2);
  return engines.length === 2 ? engines.map((word) => word.replaceAll('"', "")) : null;
}

/** The games a duel's output says it played (« — 250 parties »), or null. */
export function gamesOf(output) {
  const found = /— (\d+) parties/.exec(output ?? "");
  return found ? Number(found[1]) : null;
}

/**
 * The memory guard's floor (Sami, 23/10): a job is stopped when the free memory stays under `LOPIN_RAM_FLOOR`
 * GB (5 by default, the margin the solver pools keep; 0 turns the guard off) for `holds` samples in a row.
 */
export function memoryFloorGb(env = process.env) {
  const value = Number(env.LOPIN_RAM_FLOOR ?? 5);
  return Number.isFinite(value) && value >= 0 ? value : 5;
}

/**
 * Samples the free memory every `everyMs` until `stop()`, which returns the free memory at the start and at its
 * lowest, in GB. With a `floorGb` above 0, `onLow(gb)` is called once when the free memory stays under it for
 * `holds` samples in a row. `read` gives the free bytes (os.freemem; a test passes its own).
 */
export function watchMemory({ everyMs = 5_000, floorGb = 0, holds = 2, onLow = () => {}, read = () => os.freemem() } = {}) {
  const start = read();
  let low = start;
  let under = 0;
  let fired = false;
  const sample = () => {
    const free = read();
    low = Math.min(low, free);
    under = floorGb > 0 && free < floorGb * GB ? under + 1 : 0;
    if (!fired && under >= holds) {
      fired = true;
      onLow(round(free / GB));
    }
  };
  const timer = setInterval(sample, everyMs);
  return {
    sample,
    stop() {
      clearInterval(timer);
      low = Math.min(low, read());
      return { freeGbStart: round(start / GB), freeGbLow: round(low / GB) };
    },
  };
}

/** One line of the log. `started` and `ended` are Dates; `memory` comes from `watchMemory().stop()`, `temperature` from `watchHeat().stop()`. */
export function jobLine({ id, command, threads, started, ended, status, output = "", memory = {}, temperature = {}, source, queue = "" }) {
  const minutes = (ended - started) / 60_000;
  const games = gamesOf(output);
  return {
    id,
    kind: jobKind(command),
    source,
    ...(queue ? { queue } : {}),
    command,
    ...(enginesOf(command) ? { engines: enginesOf(command) } : {}),
    threads,
    cores: os.cpus().length,
    startedAt: started.toISOString(),
    minutes: round(minutes, 2),
    status,
    ...(games ? { games, gamesPerHour: round((60 * games) / Math.max(minutes, 1 / 60)) } : {}),
    ...memory,
    ...temperature,
  };
}

/** The log's folder: data/job-log/ (the tests point `root` elsewhere). */
const folderOf = (root) => new URL("data/job-log/", root);

/** Appends `line` to its month's file. */
export async function appendJobLog(line, { root = new URL("../../../", import.meta.url) } = {}) {
  const folder = folderOf(root);
  await mkdir(folder, { recursive: true });
  await appendFile(new URL(`${line.startedAt.slice(0, 7)}.jsonl`, folder), `${JSON.stringify(line)}\n`);
}

/** Every logged line, months in order. */
export async function readJobLog({ root = new URL("../../../", import.meta.url) } = {}) {
  const folder = folderOf(root);
  const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith(".jsonl")).sort();
  const texts = await Promise.all(names.map((name) => readFile(new URL(name, folder), "utf8")));
  return texts.flatMap((text) => text.split("\n").filter(Boolean).map((line) => JSON.parse(line)));
}
