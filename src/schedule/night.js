import { createRng } from "../core/random.js";
import { holdOf, indexJobs, minutesOf, nextJob, weightOf } from "./order.js";
import { stopReason } from "./stop.js";

/**
 * A simulated night of the backlog (Sami, 22/10): the engine of the Ordonnanceur tab, and the simulator of
 * docs/ismcts-ailleurs/backlog.md § 6. One job at a time and the runner's own choice (`nextJob`), with one
 * difference: this runner waits for a job still to come (`arrivesAt`, minutes after the start) or for a
 * `notBefore`, where `npm run backlog` stops when nothing is ready.
 *
 * A scenario is what the night hides (backlog.md § 4): each job's real length (its estimate times a
 * factor, around 0.9 as in October's history), whether it fails and when, and for a duel (`version`) its
 * pairs' mean — the version's true strength plus the duel's own noise — so that a series' `stopIf` fall
 * as they would. Weights: `weightOf` (urgent 4, normal 2, can wait 1).
 */
export const DEFAULT_KNOBS = Object.freeze({ spread: 0.11, failRate: 0.01, strengthSd: 0.03, duelNoise: 0.028, mean: 0.496 });
const LIMIT = 120;
const MINUTE = 60_000;

/** A standard normal draw (Box-Muller). */
function normal(rng) {
  const u = 1 - rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** What the night hides, drawn from `seed`: per job id, `{ factor, fails, failAt, mean }`. */
export function drawScenario(jobs, seed, knobs = DEFAULT_KNOBS) {
  const rng = createRng(seed);
  const strengths = new Map();
  const strengthOf = (version) => {
    if (!strengths.has(version)) strengths.set(version, knobs.mean + knobs.strengthSd * normal(rng));
    return strengths.get(version);
  };
  return Object.fromEntries(
    jobs.map((job) => {
      const factor = 0.9 * Math.exp(knobs.spread * normal(rng));
      const fails = rng.next() < (job.failRate ?? knobs.failRate);
      const failAt = rng.next();
      const mean = job.version ? strengthOf(job.version) + knobs.duelNoise * normal(rng) : null;
      return [job.id, { factor, fails, failAt, mean }];
    }),
  );
}

/** How a job ends in its scenario: its minutes and status (failed partway, stopped at its limit, or done). */
export function outcomeOf(job, draw) {
  const real = minutesOf(job.estimate) * draw.factor;
  const limit = job.limit ?? LIMIT;
  if (draw.fails) return { minutes: Math.min(real, limit) * draw.failAt, status: "failed" };
  return real > limit ? { minutes: limit, status: "timeout" } : { minutes: real, status: "done" };
}

/** When the waiting runner wakes: the next arrival, or the next `notBefore` of a job already there; null if never. */
function wakeTime(visible, arrivals, start, clock) {
  const times = [
    ...arrivals.map((job) => start + job.arrivesAt * MINUTE),
    ...visible.filter((job) => job.status === "scheduled").map((job) => Date.parse(job.notBefore)),
  ].filter((time) => time > clock);
  return times.length ? Math.min(...times) : null;
}

/** A finished duel's output as the runner reads it for `stopIf`. */
const outputOf = (job) => (job.pairs === undefined || job.pairs === null ? "" : `  paires : n = 125, moyenne ${job.pairs.toFixed(4)}`);

/** Plays one job (or skips it) at `clock`; returns its step. */
function playJob(job, { visible, archive, scenario, clock }) {
  const reason = stopReason(job, [...archive, ...visible], outputOf);
  if (reason) {
    archive.push({ ...job, status: "skipped" });
    return { id: job.id, start: clock, end: clock, status: "skipped", reason };
  }
  const draw = scenario[job.id];
  const { minutes, status } = outcomeOf(job, draw);
  const end = clock + minutes * MINUTE;
  archive.push({ ...job, status, pairs: status === "done" ? draw.mean : null });
  return { id: job.id, start: clock, end, status, late: Boolean(job.due) && end > Date.parse(job.due) };
}

const arrivesLater = (job) => (job.arrivesAt ?? 0) > 0;

/** One move of the night: the next job played, or the clock moved to the next wake; false once nothing is left. */
function advance(night, { scenario, start, fifo }) {
  while (night.arrivals.length > 0 && start + night.arrivals[0].arrivesAt * MINUTE <= night.clock) night.visible.push(night.arrivals.shift());
  const job = nextJob(night.visible, night.archive, night.clock, { fifo });
  if (job) {
    night.visible = night.visible.filter((other) => other !== job);
    const step = playJob(job, { ...night, scenario });
    night.steps.push(step);
    night.clock = step.end;
    return true;
  }
  const wake = wakeTime(night.visible, night.arrivals, start, night.clock);
  if (wake === null) return false;
  night.idle += wake - night.clock;
  night.clock = wake;
  return true;
}

/**
 * The night `jobs` make in `scenario`, from `start` (ms): the steps in order (`{ id, start, end, status,
 * late, reason }`), what still waits at the end and why, and the night's measures (`metricsOf`).
 */
export function simulateNight(jobs, scenario, { start, nightMinutes = 480, fifo = false }) {
  const night = {
    arrivals: jobs.filter(arrivesLater).sort((x, y) => x.arrivesAt - y.arrivesAt),
    visible: jobs.filter((job) => !arrivesLater(job)),
    archive: [],
    steps: [],
    clock: start,
    idle: 0,
  };
  while (advance(night, { scenario, start, fifo }));
  const byId = indexJobs(night.visible, night.archive);
  const waiting = night.visible.map((job) => ({ id: job.id, ...holdOf(job, byId, night.clock) }));
  return { steps: night.steps, waiting, metrics: metricsOf(jobs, night.steps, { start, nightMinutes, idle: night.idle }) };
}

/** Did the job with a `due` miss it: not done, or done after it? */
const missed = (job, done) => !done || done.end > Date.parse(job.due);

/**
 * A night's measures: the weight of the jobs done by the morning (of all the jobs' weight), how many were
 * done, skipped, failed (or stopped at their limit), the due times missed, the minutes past the morning
 * and the minutes spent waiting.
 */
export function metricsOf(jobs, steps, { start, nightMinutes, idle = 0 }) {
  const morning = start + nightMinutes * MINUTE;
  const doneById = new Map(steps.filter((step) => step.status === "done").map((step) => [step.id, step]));
  const byMorning = jobs.filter((job) => doneById.get(job.id)?.end <= morning);
  const lastEnd = Math.max(start, ...steps.map((step) => step.end));
  const withDue = jobs.filter((job) => job.due);
  return {
    value: byMorning.reduce((sum, job) => sum + weightOf(job), 0),
    maxValue: jobs.reduce((sum, job) => sum + weightOf(job), 0),
    done: byMorning.length,
    jobs: jobs.length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    failed: steps.filter((step) => step.status === "failed" || step.status === "timeout").length,
    late: withDue.filter((job) => missed(job, doneById.get(job.id))).length,
    withDue: withDue.length,
    overrun: Math.max(0, lastEnd - morning) / MINUTE,
    idle: idle / MINUTE,
    end: lastEnd,
  };
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** The mean of each measure over several nights. */
function meansOf(metrics) {
  return Object.fromEntries(["value", "done", "skipped", "failed", "late", "overrun", "idle"].map((key) => [key, mean(metrics.map((one) => one[key]))]));
}

/**
 * The file order against Smith's rule on the same `nights` scenarios (seeds `seed`, `seed + 1`, …): each
 * policy's means, and the paired difference of the weight done by morning, Smith minus file order, with its
 * 95 % interval and the nights Smith won, tied and lost.
 */
export function comparePolicies(jobs, { nights = 500, seed = 1, knobs = DEFAULT_KNOBS, start, nightMinutes = 480 }) {
  const fifo = [];
  const smith = [];
  for (let night = 0; night < nights; night += 1) {
    const scenario = drawScenario(jobs, seed + night, knobs);
    fifo.push(simulateNight(jobs, scenario, { start, nightMinutes, fifo: true }).metrics);
    smith.push(simulateNight(jobs, scenario, { start, nightMinutes }).metrics);
  }
  const gaps = smith.map((one, night) => one.value - fifo[night].value);
  const gap = mean(gaps);
  const sd = Math.sqrt(mean(gaps.map((value) => (value - gap) ** 2)));
  const margin = (1.96 * sd) / Math.sqrt(nights);
  return {
    nights,
    maxValue: fifo[0]?.maxValue ?? 0,
    fifo: meansOf(fifo),
    smith: meansOf(smith),
    gap: { mean: gap, low: gap - margin, high: gap + margin },
    wins: gaps.filter((value) => value > 0).length,
    ties: gaps.filter((value) => value === 0).length,
    losses: gaps.filter((value) => value < 0).length,
  };
}
