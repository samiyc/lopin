import { OFFICIAL_RULES } from "../../../src/config/rules.js";
import { createRng } from "../../../src/core/random.js";
import { rulesOf } from "../../../src/replay/core/log.js";
import { engineFor, rolloutPolicyOf, strategistBot } from "../../../src/sim/bots.js";
import { CORES, EXPERIMENT } from "../../../src/sim/heuristics/experimental.js";
import { applyMove, createGame, legalMoves, playGame } from "../../../src/sim/engine/game.js";

/**
 * What the core costs, in milliseconds, measured on one thread on seeded
 * positions (`npm run retrospective` shows it): a scoring of every move, a
 * whole game played by the core alone, one iteration of the 0.9's tree —
 * each with the core as it is, and with the neighbours (`nb1`).
 */
const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))];
const round = (x) => Number(x.toFixed(x < 1 ? 3 : 1));

/** Positions of seeded games between two cores, every 4 turns from turn 4 to 28, as (seed, turn). */
const positions = () => Array.from({ length: 10 }, (_, s) => [4, 8, 12, 16, 20, 24, 28].map((turn) => ({ seed: s + 1, turn }))).flat();

/** The live game of `seed` at `turn` (positions are replayed rather than cloned: the evaluator is shared). */
function stateAt(seed, turn) {
  const rng = createRng(seed);
  const cores = [strategistBot(rng, EXPERIMENT), strategistBot(rng, EXPERIMENT)];
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  while (!state.over && state.turn < turn) applyMove(state, cores[state.current].choose(state, legalMoves(state)));
  return state;
}

/** Median and 90th percentile of one scoring of every legal move, in ms. */
function scoring(states, settings) {
  const bot = strategistBot(createRng(1), settings);
  const times = states.map((state) => {
    const moves = legalMoves(state);
    const started = performance.now();
    for (let r = 0; r < 5; r += 1) bot.scoreMoves(state, moves);
    return (performance.now() - started) / 5;
  });
  return { median: round(median(times)), p90: round(quantile(times, 0.9)) };
}

/** Milliseconds for a whole game between two copies of a rollout core. */
function wholeGame(settings) {
  const started = performance.now();
  const games = 20;
  for (let g = 0; g < games; g += 1) {
    const rng = createRng(100 + g);
    const policy = rolloutPolicyOf(settings);
    playGame(spec, { order, jokerRule, rng, endMode: "final", bots: [policy(rng), policy(rng)] });
  }
  return round((performance.now() - started) / games);
}

/** Milliseconds per iteration of a tree engine, on the positions. */
function treeIteration(states, engine) {
  let iterations = 0;
  const started = performance.now();
  for (const state of states) {
    const bot = engineFor(engine)(createRng(3));
    const search = bot.searchFor(state, legalMoves(state), {});
    for (let i = 0; i < 150 && !search.done(); i += 1) search.step();
    iterations += search.rollouts();
  }
  return round((performance.now() - started) / Math.max(1, iterations));
}

export function coreTimings() {
  const states = positions().map(({ seed, turn }) => stateAt(seed, turn)).filter((state) => !state.over && legalMoves(state).length > 1);
  const sample = states.filter((_, i) => i % 3 === 0);
  const rows = [
    { label: "noter tous les coups, cœur du 0.9 (vrai coup, avec les certitudes)", ...scoring(states, EXPERIMENT) },
    { label: "noter tous les coups, cœur des simulations (sans certitudes)", ...scoring(states, { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "certain") }) },
    { label: "noter tous les coups, avec le voisinage (nb1)", ...scoring(states, CORES.nb1) },
  ];
  const tree = treeIteration(sample, "ismcts+widen=3+depth=5@800");
  const treeNb = treeIteration(sample, "ismcts+widen=3+depth=5+core=nb1@800");
  return {
    positions: states.length,
    scoring: rows,
    game: { exp: wholeGame(EXPERIMENT), nb1: wholeGame(CORES.nb1) },
    tree: { ms: tree, perSecond: Math.round(1000 / tree), move800: Math.round(800 * tree), page10s: Math.round(10000 / tree) },
    treeNb: { ms: treeNb, perSecond: Math.round(1000 / treeNb), move800: Math.round(800 * treeNb) },
  };
}
