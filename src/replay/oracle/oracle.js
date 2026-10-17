import { parseCard } from "../../core/notation.js";

/**
 * The oracle (Sami, 03/10): a tree search over every legal move with a large
 * budget, run on positions of the kept games, to find what the core leaves
 * out. Pure: the search and the replays are `scripts/oracle.js`'s.
 *
 * The 0.9 searches the core's 8 best moves at the root (`candidates`) and its
 * 3 best replies below (`widen`). A gap is the oracle's move outside the
 * core's top 3; outside its top 8, the 0.9 never looks at it at all.
 *
 * Two economies (Sami, 03/10: no time lost): a search stops as soon as its
 * favourite cannot be caught (`+smart=1`, budget.js), and the second run, the
 * one that checks the first is not luck, is only made when the first finds a
 * move outside the core's top 3 — elsewhere there is no gap to confirm.
 */
// `version`: 1 as long as the oracle plays every move the same (its fingerprint,
// `npm run fingerprint`); a change that alters a move — a bug fixed, an idea —
// raises it, and what it said before stops being the reference.
export const ORACLE = Object.freeze({
  version: 1,
  engine: "ismcts+candidates=99+widen=6+depth=5+smart=1",
  budget: 20_000,
  turns: Object.freeze([15, 16, 20, 21, 25, 26]),
  top: 3,
  shortlist: 8,
});

/**
 * The oracles by version (Sami, 14/10; `Oracle2` in docs/glossaire.md): 1 is the frozen one above; 2 is the same
 * search with what the 1.2 added — its core `stfig6`, the exact solver up to 12 cards, 7 replies (no dearer an
 * iteration: 0.99× measured) — so that its gaps with the 1.2 come from the root (every move) and the budget alone.
 * `npm run oracle -- --oracle 2`. `ORACLE` stays version 1 until a duel says otherwise.
 */
export const ORACLES = Object.freeze({
  1: ORACLE,
  2: Object.freeze({ ...ORACLE, version: 2, engine: "ismcts+candidates=99+widen=7+depth=5+smart=1+core=stfig6+exact=12" }),
  // Oracle3 (Sami, 14/10): the deep oracle Budget20000-Depth10Pw, the 1.2's own root with pw, the first judge stronger
  // than the 1.2 (57.1 % over 280 games against the 1.2@2000).
  3: Object.freeze({ ...ORACLE, version: 3, engine: "ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=1" }),
});

/** The oracle of a version (1 when none is given), or an error naming the known ones. */
export function oracleOf(version = 1) {
  const oracle = ORACLES[version];
  if (!oracle) throw new Error(`Oracle inconnu : « ${version} » (${Object.keys(ORACLES).join(", ")})`);
  return oracle;
}

const same = (a, b) => Boolean(a && b) && a.card === b.card && a.border === b.border;

/** The core's moves from best to worst; those its habits refuse come last. */
export function coreRanking(scored) {
  return [...scored].sort((a, b) => Number(Boolean(a.refused)) - Number(Boolean(b.refused)) || b.gain - a.gain).map(({ move }) => move);
}

/** 1 for the core's favourite, and so on. */
export const rankOf = (ranking, move) => ranking.findIndex((other) => same(other, move)) + 1;

/** A search's favourite (gain = visits) and the share of the visits it and the runner-up got. */
export function favouriteOf(scored) {
  const sorted = [...scored].sort((a, b) => b.gain - a.gain);
  const total = sorted.reduce((sum, entry) => sum + entry.gain, 0) || 1;
  return { move: sorted[0].move, share: sorted[0].gain / total, runnerUp: (sorted[1]?.gain ?? 0) / total };
}

/**
 * What one position says: the oracle's favourite, its rank for the core,
 * whether the runs agree (`stable`; null with a single run), and whether it
 * is a gap — a stable move outside the core's top 3.
 */
export function verdictOf(ranking, runs) {
  const [first, second] = runs.map(favouriteOf);
  const stable = second ? same(first.move, second.move) : null;
  const rank = rankOf(ranking, first.move);
  return {
    move: first.move,
    share: first.share,
    runnerUp: first.runnerUp,
    stable,
    rank,
    gap: stable === true && rank > ORACLE.top,
    unseen: stable === true && rank > ORACLE.shortlist,
  };
}

/** Is a second run worth making? Only when the first run's favourite is outside the core's top 3. */
export const needsSecondRun = (ranking, firstRun) => rankOf(ranking, favouriteOf(firstRun).move) > ORACLE.top;

/**
 * The confirmation by play (`npm run oracle -- --confirm`): from a gap's
 * position, the oracle's move, the core's favourite and the 0.9's move are
 * each played out by the 0.9 on both sides, from several seeds, and judged at
 * turn 30 by the exact solver. A gap is confirmed when the oracle's move holds
 * the game more often.
 */

/** "7♥→1" back to the move it names. */
export function moveOfLabel(spec, label) {
  const [card, border] = label.split("→");
  return { card: parseCard(spec, card), border: Number(border) - 1 };
}

/** The moves a gap plays out, each once: the oracle's, the core's favourite, and the 0.9's when it is another. */
export const movesToConfirm = (entry) => [...new Set([entry.move, entry.core[0], entry.played].filter(Boolean))];

/** Who holds the game at turn 30, as the mover's points: 1, ½ for a draw, 0; null when the solver ran out of positions. */
export function pointsFor(holder, mover) {
  if (holder === undefined) return null;
  if (holder === null) return 0.5;
  return holder === mover ? 1 : 0;
}

const meanOf = (values) => (values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : null);

/** What a gap's play-outs say: the oracle's move against the core's favourite, and against the 0.9's move. */
export function confirmVerdict(entry, means) {
  const lead = (label) => (label && label !== entry.move && means[label] !== null && means[entry.move] !== null ? means[entry.move] - means[label] : null);
  return { vsCore: lead(entry.core[0]), vsPlayed: lead(entry.played) };
}

/** The mean of a list of differences and the half-width of its 95 % interval. */
export function meanAndHalf(values) {
  const mean = meanOf(values) ?? 0;
  const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return { mean, half: 1.96 * Math.sqrt(variance / Math.max(1, values.length)), count: values.length };
}

export { meanOf };
