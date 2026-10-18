/**
 * The Labo's profiler (lot 3, Sami 17/10): `+probe` is not a setting but an option a search is created with
 * (`createIsmcts(…, { probe: newProbe() })`). It times each part of an iteration — the deal, the walk down the tree,
 * the rollout, the result carried back up — and counts the core's evaluations and the rollout's plies. The counting
 * wraps the core and the rollout policy without touching what they return or the randomness they draw, so a probed
 * search plays the same moves (tests/sim-search/probe.test.js); without a probe nothing is wrapped nor timed.
 */
export const newProbe = () => ({ iterations: 0, dealMs: 0, descentMs: 0, rolloutMs: 0, backupMs: 0, coreCalls: 0, rolloutPlies: 0, treePlies: 0 });

/** `object` with its method `name` counted by `tick`, everything else (prototype included) as it was. */
function counted(object, name, tick) {
  const original = object[name];
  return Object.assign(Object.create(Object.getPrototypeOf(object)), object, {
    [name]: (...args) => {
      tick();
      return original.apply(object, args);
    },
  });
}

/** The search's context with its core and rollout policy counted into `probe`. */
export function probed(ctx, probe) {
  const judge = counted(ctx.judge, "scoreMoves", () => (probe.coreCalls += 1));
  const rollout = counted(ctx.rollout, "choose", () => (probe.rolloutPlies += 1));
  return Object.assign(ctx, { judge, rollout, probe });
}

/** An ISMCTS iteration from its stages (ismcts.js), each stage timed into `ctx.probe`. */
export function timedIteration({ begin, walk, finish, backUp }) {
  return (root, ctx) => {
    const probe = ctx.probe;
    const t0 = performance.now();
    const { game, first } = begin(root, ctx);
    const t1 = performance.now();
    const walked = walk(root, game, ctx, first);
    const t2 = performance.now();
    const winner = finish(game, ctx, walked.played);
    const t3 = performance.now();
    backUp(walked, game, winner, ctx);
    Object.assign(probe, { dealMs: probe.dealMs + t1 - t0, descentMs: probe.descentMs + t2 - t1, rolloutMs: probe.rolloutMs + t3 - t2, backupMs: probe.backupMs + performance.now() - t3 });
    probe.iterations += 1;
    probe.treePlies += walked.path.length;
  };
}

/** Several probes (an ensemble's trees, the workers of one move) added up. */
export function addProbes(probes) {
  const total = newProbe();
  for (const probe of probes.filter(Boolean)) for (const key of Object.keys(total)) total[key] += probe[key] ?? 0;
  return total;
}

/**
 * What the Labo shows of a probe, PURE: the iterations a second of search time, each part's share of an iteration,
 * the core's evaluations, the tree's and the rollout's plies per iteration.
 */
export function probeSummary(probe) {
  if (!probe || probe.iterations === 0) return null;
  const parts = { deal: probe.dealMs, descent: probe.descentMs, rollout: probe.rolloutMs, backup: probe.backupMs };
  const totalMs = Object.values(parts).reduce((sum, ms) => sum + ms, 0);
  const share = Object.fromEntries(Object.entries(parts).map(([key, ms]) => [key, totalMs > 0 ? ms / totalMs : 0]));
  const per = (count) => count / probe.iterations;
  return { iterations: probe.iterations, perSecond: totalMs > 0 ? (1000 * probe.iterations) / totalMs : null, msPerIteration: totalMs / probe.iterations, share, coreCalls: per(probe.coreCalls), rolloutPlies: per(probe.rolloutPlies), treePlies: per(probe.treePlies) };
}
