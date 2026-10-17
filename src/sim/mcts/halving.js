/**
 * The root's candidates chosen by halving instead of UCB (`ismcts+halving=1000-500-500`,
 * Sami, 05/10). At the root only the final choice counts (the simple regret),
 * where UCB spends its visits on the leader: the theory of fixed-budget best
 * arm identification (Sequential Halving, Karnin et al. 2013) and MCTS that
 * use it at the root (SR+CR, Tolpin & Shimony 2012; H-MCTS, Pepels et al. 2014;
 * Gumbel MuZero) share the visits evenly instead, then drop the worse half.
 *
 * The phases are iteration counts: with 1000-500-500, the 8 candidates share
 * the first 1 000 iterations in turn (125 each), the best 4 by win rate the
 * next 500 (125 more each), the best 2 the last 500 (250 more each, 500 in
 * all). The candidate played is the finalist with the best win rate. Below the
 * root, the tree keeps UCB.
 */

/** "1000-500-500" → [1000, 500, 500]; anything else → null. */
export function parseHalving(text) {
  const phases = String(text ?? "").split("-").map(Number);
  return phases.length > 0 && phases.every((n) => Number.isInteger(n) && n > 0) ? phases : null;
}

/** The best `count` of `moves` by win rate (more visits first on a tie). */
function keepBest(moves, statsOf, count) {
  const rate = (move) => {
    const { visits, wins } = statsOf(move);
    return visits > 0 ? wins / visits : 0;
  };
  return [...moves].sort((a, b) => rate(b) - rate(a) || statsOf(b).visits - statsOf(a).visits).slice(0, count);
}

/**
 * The halving of `moves` over `phases`. `pick(iteration, statsOf)`: the
 * candidate to descend into at that iteration (0 for the first), dropping the
 * worse half at each phase's end but the last; `alive()`: the candidates
 * still in. `statsOf(move)` returns `{ visits, wins }` for the root's player.
 */
export function createHalving(phases, moves) {
  const ends = phases.map((_, i) => phases.slice(0, i + 1).reduce((sum, n) => sum + n, 0));
  let alive = [...moves];
  let phase = 0;
  let start = 0;
  return {
    pick(iteration, statsOf) {
      while (phase < ends.length - 1 && iteration >= ends[phase]) {
        alive = keepBest(alive, statsOf, Math.ceil(alive.length / 2));
        start = ends[phase];
        phase += 1;
      }
      return alive[(iteration - start) % alive.length];
    },
    alive: () => alive,
    /** The candidate to play: the best win rate among those still in. */
    best: (statsOf) => keepBest(alive, statsOf, 1)[0],
  };
}
