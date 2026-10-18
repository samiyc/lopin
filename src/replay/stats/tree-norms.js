/**
 * « Déjà rencontré » (the Labo, lot 3), PURE: how a decision's tree compares with the Expérimental 1.2's own in the
 * kept duels, turn by turn. Two numbers describe a tree:
 * - `top`: the share of the visits its favourite took — low, the search hesitated;
 * - `flat`: the share of the nodes of ply 2 visited once — high, the opponent's replies were barely looked at.
 * `npm run lab-index` keeps each turn's quantiles (every 5 %) in data/lab-configs.json; the page places a decision
 * among them.
 */
export const NORM_STEPS = 20;

/** The two numbers of a tree: from a duel's move (`candidates` with visits as `gain`, `tree`), or null. */
export function duelNumbers(entry) {
  const { levels = [], iterations = 0 } = entry.tree ?? {};
  const { candidates = [] } = entry;
  if (!levels[1] || !iterations || candidates.length === 0) return null;
  return numbersOf(candidates, iterations, levels[1]);
}

function numbersOf(candidates, iterations, ply2) {
  const top = Math.max(...candidates.map((candidate) => candidate.gain)) / iterations;
  return { top, flat: ply2.nodes > 0 ? ply2.one / ply2.nodes : 0 };
}

/** The two numbers of a Labo report (`{ root, trees }`): its trees' ply 2 pooled. */
export function labNumbers(lab) {
  const root = lab?.root ?? [];
  const total = root.reduce((sum, entry) => sum + entry.visits, 0);
  const plies = (lab?.trees ?? []).map((tree) => tree.levels?.[1]).filter(Boolean);
  const nodes = plies.reduce((sum, level) => sum + level.nodes, 0);
  if (total === 0 || nodes === 0) return null;
  return { top: Math.max(...root.map((entry) => entry.visits)) / total, flat: plies.reduce((sum, level) => sum + level.one, 0) / nodes };
}

/** `values`' quantiles at 0, 5, …, 100 %, rounded to 4 decimals. */
export function quantiles(values, steps = NORM_STEPS) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: steps + 1 }, (_, k) => {
    const at = (k / steps) * (sorted.length - 1);
    const low = Math.floor(at);
    const value = sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * (at - low);
    return Math.round(value * 10000) / 10000;
  });
}

/** The share of the distribution `points` (its quantiles) below `value`, between 0 and 1. */
export function rankIn(points, value) {
  const steps = points.length - 1;
  if (value <= points[0]) return 0;
  if (value >= points[steps]) return 1;
  const k = points.findIndex((point) => point >= value);
  const span = points[k] - points[k - 1];
  return (k - 1 + (span > 0 ? (value - points[k - 1]) / span : 0.5)) / steps;
}

/**
 * A decision placed among the 1.2's moves of its turn (`norms.turns[turn]`): `{ moves, top, flat, hesitates, flatter }`
 * — its numbers, and the share of those moves whose favourite held more of the visits (`hesitates`: « plus incertain
 * que … ») and whose ply 2 was seen once less often (`flatter`). Null without a tree or without that turn.
 */
export function placeDecision(lab, norms, turn) {
  const norm = norms?.turns?.[turn];
  const numbers = labNumbers(lab);
  if (!norm || !numbers) return null;
  return { moves: norm.moves, ...numbers, hesitates: 1 - rankIn(norm.top, numbers.top), flatter: rankIn(norm.flat, numbers.flat) };
}
