/**
 * Omniscient 1.0 judging deals (`npm run deals`), PURE: how a deal leans once
 * both players see everything. `firsts[d]` is how many of the `plays` games
 * of deal d the first player won (a draw counts half).
 *
 * - `first`: the first player's share over every game, the seat advantage
 *   left between omniscients — the rules' part, not the information's;
 * - `decided`: deals one side wins in at least `DECIDED` of the games, whoever
 *   plays: luck, as far as these players go;
 * - `balanced`: deals between `BALANCED` — the pool to judge ideas on.
 */
export const DECIDED = 0.9;
export const BALANCED = Object.freeze([0.4, 0.6]);

const wilson = (share, n, z = 1.96) => {
  const centre = (share + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z / (1 + (z * z) / n)) * Math.sqrt((share * (1 - share)) / n + (z * z) / (4 * n * n));
  return [centre - half, centre + half];
};

/**
 * The first player's share in this run minus in `base` (an earlier `npm run deals` file), deal by deal on the seeds
 * both played: the effect of a seat compensation, with a paired interval (the deal's luck cancels out).
 */
export function pairedDifference({ shares, seeds }, base) {
  const before = new Map(base.seeds.map((seed, d) => [seed, base.shares[d]]));
  const gaps = shares.flatMap((share, d) => (before.has(seeds[d]) ? [share - before.get(seeds[d])] : []));
  if (gaps.length < 2) return { deals: gaps.length, gap: Number.NaN, interval: [Number.NaN, Number.NaN] };
  return { deals: gaps.length, gap: mean(gaps), interval: meanInterval(gaps) };
}

/** Deals by tenth of the first player's share: `[0, 0.1)`, … , `[0.9, 1]`. */
const tenths = (shares) => {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const share of shares) counts[Math.min(9, Math.floor(share * 10))] += 1;
  return counts;
};

/**
 * The pool of `size` deals (`npm run deals -- --pool f --size N`): the ones nearest the median share, in deal
 * order. The root of a search overrates the first player, so a fixed 40-60 % band would sit off centre; the
 * median moves with that bias. Returns the deals' indices and the band they span.
 */
export function nearestMedian(shares, size) {
  const sorted = [...shares].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const byDistance = shares.map((share, d) => ({ d, gap: Math.abs(share - median) })).sort((a, b) => a.gap - b.gap || a.d - b.d);
  const picked = byDistance.slice(0, size).map(({ d }) => d).sort((a, b) => a - b);
  const kept = picked.map((d) => shares[d]);
  return { picked, median, band: [Math.min(...kept), Math.max(...kept)] };
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** The mean of `values` and its 95 % interval from their spread: one value a deal, so the deals count, not the games. */
function meanInterval(values, z = 1.96) {
  const centre = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - centre) ** 2, 0) / Math.max(1, values.length - 1);
  const half = z * Math.sqrt(variance / values.length);
  return [centre - half, centre + half];
}

/**
 * The first player's share and the rest. With K plays a deal, games of one deal hang together (the deal explains
 * most of the variance), so the interval comes from the spread between deals; one play a deal is Wilson's.
 */
export function judgeDeals(firsts, plays) {
  const shares = firsts.map((wins) => wins / plays);
  const first = mean(shares);
  const decided = shares.filter((share) => share >= DECIDED || share <= 1 - DECIDED).length;
  const balanced = shares.filter((share) => share >= BALANCED[0] && share <= BALANCED[1]).length;
  return {
    deals: shares.length,
    plays,
    first,
    firstInterval: plays > 1 ? meanInterval(shares) : wilson(first, shares.length),
    decided: decided / shares.length,
    balanced: balanced / shares.length,
    tenths: tenths(shares),
    shares,
  };
}
