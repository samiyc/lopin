import { createRng } from "../core/random.js";
import { minutesOf } from "./order.js";

/**
 * What can stop the machine during a night (Sami, 22/10), drawn apart from the jobs' scenario so that both
 * orders meet the same ones (docs/ismcts-ailleurs/backlog.md § 9.8):
 * - `heat`: the CPU passes its alert value. The guard stops the job running, waits for the CPU to cool
 *   (8 to 15 min), then the queue goes on by itself. Only while a job runs: an idle CPU stays cool.
 * - `update`: Windows restarts for an update (15 to 40 min, the install included).
 * - `power`: a power cut, 2 min to 3 h, then 3 min to boot.
 * The job running is lost: `npm run backlog` writes a job's end only when it ends, so a relaunch plays it
 * again from its start. After a restart the queue goes on only with `autoResume` (the PC switches itself
 * back on, the runner starts at boot); otherwise the night stops there.
 *
 * The rates (`CALM_MACHINE`): `heat` is the mean number of alerts over a night, `update` and `power` the
 * share of nights with one, at a time drawn over the night (`horizon` minutes).
 */
export const CALM_MACHINE = Object.freeze({ heat: 0, update: 0, power: 0 });
export const CAUSE_LABELS = Object.freeze({ heat: "alerte chaleur", update: "mise à jour de Windows", power: "coupure de courant", urgent: "un job urgent" });
const MINUTE = 60_000;
const BOOT = 3;

/** One random stream per kind of incident, so that changing one rate leaves the others' draws alone. */
const streamOf = (seed, kind) => createRng((Math.imul(seed, 0x9e3779b1) + kind * 0x85ebca6b) >>> 0);
const uniform = (rng, low, high) => low + (high - low) * rng.next();

/** The heat alerts: a Poisson process of `rate` alerts over `horizon` minutes. */
function heatAlerts(rng, rate, horizon) {
  const alerts = [];
  if (rate <= 0) return alerts;
  const gap = () => (-horizon / rate) * Math.log(1 - rng.next());
  for (let at = gap(); at < horizon; at += gap()) alerts.push({ kind: "heat", at, down: uniform(rng, 8, 15) });
  return alerts;
}

/** A restart that comes in a `share` of the nights, at a time drawn over the night. */
function restart(rng, share, horizon) {
  return rng.next() < share ? { at: rng.next() * horizon } : null;
}

/** The night's incidents, by time: `{ kind, at, down }`, `at` minutes after the start, `down` minutes stopped. */
export function drawIncidents(seed, rates = CALM_MACHINE, horizon = 480) {
  const update = restart(streamOf(seed, 1), rates.update, horizon);
  const powerRng = streamOf(seed, 2);
  const power = restart(powerRng, rates.power, horizon);
  return [
    ...heatAlerts(streamOf(seed, 0), rates.heat, horizon),
    ...(update ? [{ kind: "update", at: update.at, down: uniform(streamOf(seed, 3), 15, 40) }] : []),
    ...(power ? [{ kind: "power", at: power.at, down: BOOT + Math.exp(uniform(powerRng, Math.log(2), Math.log(180))) }] : []),
  ].sort((a, b) => a.at - b.at);
}

/**
 * Must `arrival`, coming at `time` while `running` (started at `since`) runs, interrupt it: would it miss its
 * `due` waiting for the running job's estimated end, while it makes it by starting now? Without a `due`, never.
 */
export function mustInterrupt(arrival, running, since, time) {
  if (!arrival.due) return false;
  const due = Date.parse(arrival.due);
  const own = minutesOf(arrival.estimate) * MINUTE;
  const runningEnd = Math.max(since + minutesOf(running.estimate) * MINUTE, time);
  return time + own <= due && runningEnd + own > due;
}
