/**
 * How the tree chooses, the two levers of Sami's 1.3 roadmap (11/10): the
 * root's choice between its own candidates (the oracle's move, when in the
 * top 8, is played only ~40 % of the time mid-game) and the noise of the move
 * played (two seeds agree in 19 positions of 50). Both off by default.
 */

/** A player's points: from a winner (1, ½ for a draw, 0), or from `{ share }`, seat 0's odds when a rollout was cut short (truncate.js). */
export const pointsFor = (winner, player) => {
  if (winner === null) return 0.5;
  if (typeof winner === "object") return player === 0 ? winner.share : 1 - winner.share;
  return winner === player ? 1 : 0;
};

/**
 * `margin` (MarginBackup, Sami's 1.3 roadmap, 12/10): an iteration's points
 * for a player, `(player) => number`. Off, the winner's 1, ½ or 0. On, a
 * share `margin` of them comes from the borders instead: ½ plus half the
 * player's lead in borders at the end over the seven — a win by 5 to 2
 * counts more than one by 4 to 3, a less noisy signal at no cost.
 */
export function pointsOf(game, winner, margin) {
  if (!margin || typeof winner === "object") return (player) => pointsFor(winner, player);
  const owned = [0, 0];
  for (const border of game.borders) if (border.owner === 0 || border.owner === 1) owned[border.owner] += 1;
  const lead = (player) => (owned[player] - owned[1 - player]) / game.borders.length;
  return (player) => (1 - margin) * pointsFor(winner, player) + margin * (0.5 + lead(player) / 2);
}

/**
 * UCB's exploration term at a node, for `select` (ismcts.js): UCB1's
 * `exploration × √(ln available / visits)`, or — with `puct` (PUCT) —
 * AlphaZero's `puct × prior × √available / (1 + visits)`, the core's opinion
 * as a prior. The moves come in the core's order, so the k-th (from 0) gets
 * 1 / (k + 1), normalised over the list: scale-free, unlike the core's gains.
 * Kept per length: a node offers a handful of them.
 */
const PRIORS = new Map();

function priorsFor(length) {
  if (!PRIORS.has(length)) {
    const raw = Array.from({ length }, (_, rank) => 1 / (rank + 1));
    const total = raw.reduce((sum, value) => sum + value, 0);
    PRIORS.set(length, raw.map((value) => value / total));
  }
  return PRIORS.get(length);
}

/** The exploration bonus of the `rank`-th child of a node of `count` children: `(child, rank) => number`. */
export function explorationBonus({ exploration, puct }, count) {
  if (!puct) return (child) => exploration * Math.sqrt(Math.log(child.avail) / child.visits);
  const priors = priorsFor(count);
  return (child, rank) => (puct * priors[rank] * Math.sqrt(child.avail)) / (1 + child.visits);
}

/** The ensemble's scores: each tree's `scored()` (same moves, same order), the gains added up in tree order. */
export const addScores = (ratings) => ratings[0].map((entry, index) => ({ ...entry, gain: ratings.reduce((sum, rating) => sum + rating[index].gain, 0) }));

/** How many of an ensemble's `budget` iterations tree `part` of `trees` plays: they are stepped in turn. */
export const partBudget = (budget, trees, part) => Math.ceil((budget - part) / trees);

/**
 * `trees` (Ensemble): the budget shared between `trees` searches of their own
 * seeds, stepped in turn, the root's visits added up, to take the noise out of
 * the move played. The first tree keeps the plain search's seed.
 * `createSearch` is `createIsmcts`, passed in so that the two modules do not
 * import each other. `part` builds tree `part` alone, with the seed it has in
 * the ensemble: the page runs each tree in its own worker and adds their
 * scores up with `addScores`, so it plays the moves of the duels.
 */
export function createEnsemble(createSearch, state, scored, { trees, part, ...options }) {
  const seedOf = (index) => (index === 0 ? options.seed : (options.seed ^ Math.imul(index, 0x9e3779b1)) >>> 0);
  if (part !== undefined) return createSearch(state, scored, { ...options, trees: 1, seed: seedOf(part) });
  const searches = Array.from({ length: trees }, (_, index) => createSearch(state, scored, { ...options, trees: 1, seed: seedOf(index) }));
  let iterations = 0;
  const rated = () => addScores(searches.map((search) => search.scored()));
  return {
    step() {
      searches[iterations % trees].step();
      iterations += 1;
    },
    done: () => searches[0].done(),
    rollouts: () => iterations,
    scored: rated,
    best: () => rated().reduce((a, b) => (b.gain > a.gain ? b : a)).move,
    tree: () => searches[0].tree(),
  };
}
