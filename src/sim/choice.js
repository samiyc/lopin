/**
 * How the tree chooses, the two levers of Sami's 1.3 roadmap (11/10): the
 * root's choice between its own candidates (the oracle's move, when in the
 * top 8, is played only ~40 % of the time mid-game) and the noise of the move
 * played (two seeds agree in 19 positions of 50). Both off by default.
 */

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

/**
 * `trees` (Ensemble): the budget shared between `trees` searches of their own
 * seeds, stepped in turn, the root's visits added up, to take the noise out of
 * the move played. The first tree keeps the plain search's seed.
 * `createSearch` is `createIsmcts`, passed in so that the two modules do not
 * import each other.
 */
export function createEnsemble(createSearch, state, scored, { trees, ...options }) {
  const seedOf = (index) => (index === 0 ? options.seed : (options.seed ^ Math.imul(index, 0x9e3779b1)) >>> 0);
  const searches = Array.from({ length: trees }, (_, index) => createSearch(state, scored, { ...options, trees: 1, seed: seedOf(index) }));
  let iterations = 0;
  const rated = () => {
    const ratings = searches.map((search) => search.scored());
    return ratings[0].map((entry, index) => ({ ...entry, gain: ratings.reduce((sum, rating) => sum + rating[index].gain, 0) }));
  };
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
