/**
 * Stopping a series of long duels that started badly (Sami, 05/10: two duels
 * under 50 % out of four, and the other two will not bring the lower bound
 * above it). A job may carry `stopIf`, a list of conditions
 * `{ after: [job ids], below: 0.5 }`: once every job of `after` is done, their
 * duels' pairs pooled scoring under `below` cancels this one (`skipped`), and
 * `{ after, atLeast: 0.5 }` cancels it when they score that much or more. Pure:
 * the runner (scripts/backlog.js) hands the jobs and a reader of their outputs.
 *
 * What the defaults cost (pairs' sd ≈ 0.31, 125 pairs a duel): after one duel
 * under 47 %, or two pooled under 50 %, a version truly at 52.7 % (the least
 * that clears 50 % over 1 000 games) is stopped 2 % and 8 % of the time; one at
 * 49 % would have kept a chance under 0.5 % of passing.
 */
export const STOP_RULES = Object.freeze([
  { duels: 1, below: 0.47 },
  { duels: 2, below: 0.5 },
]);

/** The pairs of a duel's output (`paires : n = 125, moyenne 0.4840, …`), or null. */
export function pairsOf(text) {
  const found = /paires : n = (\d+), moyenne ([\d.]+)/.exec(text ?? "");
  return found ? { n: Number(found[1]), mean: Number(found[2]) } : null;
}

/** The pooled mean of several duels' pairs, or null when one of them has none. */
export function pooledMean(groups) {
  if (groups.length === 0 || groups.some((group) => !group)) return null;
  const n = groups.reduce((sum, group) => sum + group.n, 0);
  return groups.reduce((sum, group) => sum + group.n * group.mean, 0) / n;
}

/**
 * Why `job` should not run, or null: the first condition of its `stopIf` whose
 * jobs are all done and whose pooled score is under its bar. `outputOf(job)`
 * returns a finished job's output text.
 */
export function stopReason(job, jobs, outputOf) {
  for (const condition of job.stopIf ?? []) {
    const earlier = condition.after.map((id) => jobs.find((other) => other.id === id));
    if (earlier.some((other) => other?.status !== "done")) continue;
    const mean = pooledMean(earlier.map((other) => pairsOf(outputOf(other))));
    const crossed = mean === null ? null : barCrossed(mean, condition);
    if (crossed) return `${condition.after.join(" + ")} : ${(100 * mean).toFixed(1)} % réunis, ${crossed}`;
  }
  return null;
}

/**
 * The bar `mean` crosses, in words, or null: under `below`, or — `atLeast` (Sami, 14/10), the other branch of a
 * choice, a job for the loser of a duel cancelled when A wins it — that much or more.
 */
function barCrossed(mean, { below, atLeast }) {
  if (below !== undefined && mean < below) return `sous ${Math.round(100 * below)} %`;
  if (atLeast !== undefined && mean >= atLeast) return `${Math.round(100 * atLeast)} % ou plus`;
  return null;
}

/** The `stopIf` of the n-th duel (1-based) of a series whose ids are `ids`, after `STOP_RULES`. */
export function stopIfFor(ids, n) {
  return STOP_RULES.filter(({ duels }) => duels < n).map(({ duels, below }) => ({ after: ids.slice(0, duels), below }));
}
