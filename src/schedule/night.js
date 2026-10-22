import { createRng } from "../core/random.js";
import { CALM_MACHINE, CAUSE_LABELS, drawIncidents, mustInterrupt } from "./incidents.js";
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
 * as they would. Weights: `weightOf` (urgent 4, normal 2, can wait 1). What stops the machine (heat, a
 * Windows restart, a power cut) is drawn apart, by incidents.js.
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

/** One job played (or skipped) from `clock` in its scenario: its step, and what the archive keeps if it ends. */
function playJob(job, { visible, archive, scenario, clock }) {
  const reason = stopReason(job, [...archive, ...visible], outputOf);
  if (reason) return { step: { id: job.id, start: clock, end: clock, status: "skipped", reason }, entry: { ...job, status: "skipped" } };
  const draw = scenario[job.id];
  const { minutes, status } = outcomeOf(job, draw);
  const end = clock + minutes * MINUTE;
  const step = { id: job.id, start: clock, end, status, late: Boolean(job.due) && end > Date.parse(job.due) };
  return { step, entry: { ...job, status, pairs: status === "done" ? draw.mean : null } };
}

const arrivesLater = (job) => (job.arrivesAt ?? 0) > 0;
const byRank = (night) => (a, b) => night.rank.get(a.id) - night.rank.get(b.id);

/** The jobs come by now join the queue, in the order they came (a job cut short gets its place back). */
function admit(night, start) {
  while (night.arrivals.length > 0 && start + night.arrivals[0].arrivesAt * MINUTE <= night.clock) {
    const job = night.arrivals.shift();
    night.rank.set(job.id, night.rank.size);
    night.visible.push(job);
  }
}

/**
 * With `preempt`: the first job to come while `job` runs that must interrupt it (`mustInterrupt`), ready to
 * start. Only under the due-aware order: the file order knows no due, it would play the interrupted job first.
 */
function urgentCut(night, job, step, { start, preempt, fifo }) {
  if (!preempt || fifo) return null;
  for (const arrival of night.arrivals) {
    const time = start + arrival.arrivesAt * MINUTE;
    const pressing = time > step.start && time < step.end && mustInterrupt(arrival, job, step.start, time);
    if (pressing && !holdOf(arrival, indexJobs([...night.visible, job, arrival], night.archive), time)) return { kind: "urgent", time, down: 0, by: arrival.id };
  }
  return null;
}

/** What cuts `step` short, or null: the first incident while it runs, or an urgent arrival (`urgentCut`). */
function cutOf(night, job, step, context) {
  if (step.end <= step.start) return null;
  const incident = night.incidents.find((one) => one.time > step.start && one.time < step.end) ?? null;
  const urgent = urgentCut(night, job, step, context);
  if (!incident || !urgent) return incident ?? urgent;
  return urgent.time < incident.time ? urgent : incident;
}

/** The first restart (update, power cut) after `from` and before `to`: a heat alert needs a job running. */
const outageIn = (night, from, to) => night.incidents.find((one) => one.kind !== "heat" && one.time > from && one.time < to);

/**
 * The machine stopped by `incident`: the night goes on after it, or ends there without `autoResume`. While
 * the CPU cools the PC is on, so a restart can still come; while it restarts, nothing else happens.
 */
function goDown(night, incident, context) {
  const end = incident.time + incident.down * MINUTE;
  const outage = incident.kind === "heat" ? outageIn(night, incident.time, end) : undefined;
  if (outage) {
    night.downs.push({ kind: "heat", start: incident.time, end: outage.time });
    return goDown(night, outage, context);
  }
  night.downs.push({ kind: incident.kind, start: incident.time, end });
  if (incident.kind !== "heat" && !context.autoResume) {
    night.stopped = { kind: incident.kind, at: incident.time };
    return false;
  }
  night.clock = end;
  return true;
}

/** `job` cut short at `cut.time`: its run so far is lost, it goes back to its place in the queue, then the cut acts. */
function interrupt(night, { job, step, cut }, context) {
  night.steps.push({ id: job.id, start: step.start, end: cut.time, status: "interrupted", cause: cut.kind, by: cut.by });
  night.visible.push(job);
  night.visible.sort(byRank(night));
  night.clock = cut.time;
  return cut.kind === "urgent" || goDown(night, cut, context);
}

/** Nothing to start: the clock moves to the next wake, unless the machine restarts first; false if nothing comes. */
function wait(night, context) {
  const wake = wakeTime(night.visible, night.arrivals, context.start, night.clock);
  if (wake === null) return false;
  const outage = outageIn(night, night.clock, wake);
  const until = outage ? outage.time : wake;
  night.idle += until - night.clock;
  night.clock = until;
  return outage ? goDown(night, outage, context) : true;
}

/** One move of the night: a job played or cut short, or the clock moved on; false once the night is over. */
function advance(night, context) {
  admit(night, context.start);
  night.incidents = night.incidents.filter((one) => one.time > night.clock);
  const job = nextJob(night.visible, night.archive, night.clock, { fifo: context.fifo });
  if (!job) return wait(night, context);
  night.visible = night.visible.filter((other) => other !== job);
  const { step, entry } = playJob(job, { ...night, scenario: context.scenario });
  const cut = cutOf(night, job, step, context);
  if (cut) return interrupt(night, { job, step, cut }, context);
  night.archive.push(entry);
  night.steps.push(step);
  night.clock = step.end;
  return true;
}

/** Why a job still waits at the end: its own hold, or the queue a restart stopped. */
function waitingOf(night, byId) {
  const halt = night.stopped && { blocked: false, reason: `file arrêtée par la ${CAUSE_LABELS[night.stopped.kind]}, sans reprise automatique` };
  return [...night.visible, ...night.arrivals].map((job) => ({ id: job.id, ...(holdOf(job, byId, night.clock) ?? halt) }));
}

/**
 * The night `jobs` make in `scenario`, from `start` (ms): the steps in order (`{ id, start, end, status,
 * late, reason }`; a job cut short has an `interrupted` step, with its `cause`, before the next), the times the
 * machine was down (`downs`), what still waits at the end and why, and the night's measures (`metricsOf`).
 * `incidents` (incidents.js, `drawIncidents`) stop the machine; `autoResume` restarts the queue after a
 * restart; `preempt` lets a job come during the night interrupt the one running to keep its `due`.
 */
export function simulateNight(jobs, scenario, { start, nightMinutes = 480, fifo = false, incidents = [], autoResume = false, preempt = false }) {
  const visible = jobs.filter((job) => !arrivesLater(job));
  const night = {
    arrivals: jobs.filter(arrivesLater).sort((x, y) => x.arrivesAt - y.arrivesAt),
    visible,
    rank: new Map(visible.map((job, index) => [job.id, index])),
    incidents: incidents.map((one) => ({ ...one, time: start + one.at * MINUTE })),
    archive: [],
    steps: [],
    downs: [],
    clock: start,
    idle: 0,
    stopped: null,
  };
  while (advance(night, { scenario, start, fifo, autoResume, preempt }));
  const waiting = waitingOf(night, indexJobs(night.visible, night.archive));
  const metrics = metricsOf(jobs, night.steps, { start, nightMinutes, idle: night.idle, downs: night.downs, stopped: night.stopped });
  return { steps: night.steps, downs: night.downs, stopped: night.stopped, waiting, metrics };
}

/** Did the job with a `due` miss it: not done, or done after it? */
const missed = (job, done) => !done || done.end > Date.parse(job.due);

const minutesIn = (spans) => spans.reduce((sum, span) => sum + span.end - span.start, 0) / MINUTE;

/**
 * A night's measures: the weight of the jobs done by the morning (of all the jobs' weight), how many were
 * done, skipped, failed (or stopped at their limit), the due times missed, the minutes past the morning
 * and the minutes spent waiting; then the incidents' cost: jobs cut short and the minutes of work they
 * lost, the minutes the machine was down, and whether the queue stopped for good (`halt`: what and when).
 */
export function metricsOf(jobs, steps, { start, nightMinutes, idle = 0, downs = [], stopped = null }) {
  const morning = start + nightMinutes * MINUTE;
  const doneById = new Map(steps.filter((step) => step.status === "done").map((step) => [step.id, step]));
  const byMorning = jobs.filter((job) => doneById.get(job.id)?.end <= morning);
  const lastEnd = Math.max(start, ...steps.map((step) => step.end));
  const withDue = jobs.filter((job) => job.due);
  const cut = steps.filter((step) => step.status === "interrupted");
  return {
    restarts: cut.length,
    lost: minutesIn(cut),
    down: minutesIn(downs),
    stopped: stopped ? 1 : 0,
    halt: stopped,
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
  return Object.fromEntries(["value", "done", "skipped", "failed", "late", "overrun", "idle", "restarts", "lost", "down", "stopped"].map((key) => [key, mean(metrics.map((one) => one[key]))]));
}

/** Each order's measures over `nights` scenarios, with the same incidents for both. */
function playNights(jobs, { nights, seed = 1, knobs = DEFAULT_KNOBS, start, nightMinutes = 480, machine = CALM_MACHINE, runner = {} }) {
  const fifo = [];
  const smith = [];
  for (let night = 0; night < nights; night += 1) {
    const scenario = drawScenario(jobs, seed + night, knobs);
    const options = { ...runner, start, nightMinutes, incidents: drawIncidents(seed + night, machine, nightMinutes) };
    fifo.push(simulateNight(jobs, scenario, { ...options, fifo: true }).metrics);
    smith.push(simulateNight(jobs, scenario, options).metrics);
  }
  return { fifo, smith };
}

/**
 * The file order against Smith's rule on the same `nights` scenarios (seeds `seed`, `seed + 1`, …): each
 * policy's means, and the paired difference of the weight done by morning, Smith minus file order, with its
 * 95 % interval and the nights Smith won, tied and lost. `machine`: the incidents' rates (incidents.js);
 * `runner`: `autoResume` and `preempt`, as `simulateNight` takes them.
 */
export function comparePolicies(jobs, settings) {
  const { nights = 500 } = settings;
  const { fifo, smith } = playNights(jobs, { ...settings, nights });
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
