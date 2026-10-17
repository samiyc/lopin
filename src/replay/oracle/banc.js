/**
 * The similarity bench (`npm run banc`, Sami, 04/10): a version of the V1 is
 * judged in minutes, not by its win rate but by how close its moves come to
 * the oracle's, on a fixed set of positions the oracle searched twice
 * (`oracle/positions-banc.jsonl`, each with both searches' 12 most visited
 * moves: `npm run oracle -- --keep 12`).
 *
 * The main measure is a move's **oracle value**: the share of the oracle's
 * visits it got, over the share its favourite got (both searches added up).
 * 1 for the oracle's own move, close to 1 for a move it nearly chose, 0 for a
 * move outside its 12. Early in a game, where the oracle hesitates between
 * many moves that are worth about the same, a move it nearly chose costs
 * little — the noise of its early searches does not punish the version.
 *
 * Pure: the searches are scripts/lib/banc-worker.js's.
 */

/** Sami's three phases: 0-1 card a column, 1-2, then 2-3. */
export const BANC_PHASES = Object.freeze([
  Object.freeze({ name: "tours 4-10", from: 4, to: 10 }),
  Object.freeze({ name: "tours 11-20", from: 11, to: 20 }),
  Object.freeze({ name: "tours 21-30", from: 21, to: Infinity }),
]);

/** Both searches' visits added up, as shares of the whole: move → share. */
export function mergedVisits(entry) {
  const runs = entry.visits ?? [];
  const shares = new Map();
  for (const run of runs) for (const { move, share } of run) shares.set(move, (shares.get(move) ?? 0) + share / runs.length);
  return shares;
}

/** What a position says: the oracle's favourite over both searches, its share, and whether both searches chose it. */
export function referenceOf(entry) {
  const shares = mergedVisits(entry);
  let [best, top] = [null, -1];
  for (const [move, share] of shares) if (share > top) [best, top] = [move, share];
  const favourites = (entry.visits ?? []).map((run) => run[0]?.move);
  // One search (a move of a whole game) counts as stable: there is nothing to disagree with.
  const stable = favourites.length > 0 && favourites.every((move) => move === favourites[0]);
  return { best, top, stable, shares };
}

/** The oracle value of a move: its share over the favourite's, 0 to 1 (0 outside the 12 kept). */
export const valueOf = (reference, move) => (reference.top > 0 ? (reference.shares.get(move) ?? 0) / reference.top : 0);

/** One position judged for one version: its oracle value, the exact agreement, and the favourite in its core's top 8. */
export function judge(entry, { move, coreTop }) {
  const reference = referenceOf(entry);
  return {
    turn: entry.turn,
    value: valueOf(reference, move),
    agrees: move === reference.best,
    stable: reference.stable,
    top8: coreTop.includes(reference.best),
  };
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

/** The averages over a list of judged positions; the agreement on the stable ones only. */
function averages(rows) {
  const stable = rows.filter((row) => row.stable);
  return {
    positions: rows.length,
    value: mean(rows.map((row) => row.value)),
    agrees: mean(stable.map((row) => Number(row.agrees))),
    stable: stable.length,
    top8: mean(rows.map((row) => Number(row.top8))),
  };
}

/** Overall and phase by phase. */
export function summarizeBanc(rows) {
  const phases = BANC_PHASES.map((phase) => ({ name: phase.name, ...averages(rows.filter((row) => row.turn >= phase.from && row.turn <= phase.to)) }));
  return { ...averages(rows), phases };
}

/**
 * The mean gap of oracle value between two versions on the same positions
 * (`a` minus `b`, position by position), with its 95 % interval over the
 * pairs. Positions where both play the same move add no noise: that is what
 * makes two versions comparable on a few thousand positions.
 */
export function pairedDiff(a, b, z = 1.96) {
  const gaps = a.map((row, i) => row.value - b[i].value);
  const n = gaps.length;
  const average = mean(gaps);
  if (n < 2) return { mean: average, low: -Infinity, high: Infinity, n, differ: 0 };
  const variance = gaps.reduce((sum, gap) => sum + (gap - average) ** 2, 0) / (n - 1);
  const half = z * Math.sqrt(variance / n);
  return { mean: average, low: average - half, high: average + half, n, differ: gaps.filter((gap) => gap !== 0).length };
}

/** « à pousser » when the gap's interval is above 0, « à écarter » below it, « neutre » across it. */
export function bancVerdict({ low, high }) {
  if (low > 0) return "à pousser";
  if (high < 0) return "à écarter";
  return "neutre";
}

/** Spearman's rank correlation, ties given their mean rank. */
export function rankCorrelation(xs, ys) {
  const ranks = (list) => list.map((x) => list.filter((y) => y < x).length + (list.filter((y) => y === x).length + 1) / 2);
  const [rx, ry] = [ranks(xs), ranks(ys)];
  const n = xs.length;
  return 1 - (6 * rx.reduce((sum, r, i) => sum + (r - ry[i]) ** 2, 0)) / (n * (n * n - 1));
}

/** A score against the 1.0 brought to the scale « against the 0.9 », through the 1.0's own score against the 0.9 (logits add up). */
export function againstBase(score, viaScore) {
  const logit = (p) => Math.log(p / (1 - p));
  const z = logit(score) + logit(viaScore);
  return 1 / (1 + Math.exp(-z));
}
