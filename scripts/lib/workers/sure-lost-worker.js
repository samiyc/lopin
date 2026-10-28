import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { rolloutPolicyOf } from "../../../src/sim/bots.js";
import { applyMove, legalMoves } from "../../../src/sim/engine/game.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { coreOf } from "../../../src/sim/heuristics/experimental.js";
import { pileDeals } from "../../../src/sim/mcts/pimc.js";
import { cloneState, determinize, playOut } from "../../../src/sim/search/lookahead.js";

/**
 * A « sure » endgame of a kept duel (scripts/archive/sure-lost.js), read under both end rules: the game's
 * `claim-end` (a proven border is closed, the game stops at the first win) and the `final` every search deal is
 * switched to (`determinize`: borders settle at the end, in fill order). Each is measured after the logged move:
 * solved exactly over the deals the mover cannot tell apart, solved on the true deal, and rolled out by the 1.2's
 * policy over random deals (what the tree's simulations believe). The solver stops at `nodes` a deal (the task's).
 */
const SAMPLED = 12;
const ROLLOUTS = 100;
const RULES = Object.freeze(["claim-end", "final"]);
const POLICY = rolloutPolicyOf(coreOf("stfig6"));

/** 1 when `player` won the finished `game`, -1 when they lost, 0 for no winner. */
function outcome(game, player) {
  if (game.winner === null) return 0;
  return game.winner === player ? 1 : -1;
}

/** The exact result of `player` after `move` on `deal` under `endMode` (1 won, 0 drawn, -1 lost), null past the cap. */
function solved(deal, { move, player, nodes }, endMode) {
  const game = Object.assign(cloneState(deal), { endMode });
  applyMove(game, move);
  if (game.over) return outcome(game, player);
  const solution = solveEndgame(game, { stopAtWin: true, maxNodes: nodes });
  return solution.complete ? -solution.value : null;
}

/** The share of `deals` won after `move`, those the solver finished only; null when it finished none. */
function shareWon(deals, side, endMode) {
  const values = deals.map((deal) => solved(deal, side, endMode)).filter((value) => value !== null);
  return values.length > 0 ? values.filter((value) => value > 0).length / values.length : null;
}

/** The policy's share of wins after `move` over `ROLLOUTS` random deals, played to the end under `endMode`. */
function rolled(state, { move, player }, endMode) {
  let wins = 0;
  for (let k = 0; k < ROLLOUTS; k += 1) {
    const rng = createRng(k + 1);
    const game = Object.assign(determinize(state, player, rng), { endMode });
    applyMove(game, move);
    if ((game.over ? game.winner : playOut(game, POLICY(rng))) === player) wins += 1;
  }
  return wins / ROLLOUTS;
}

const dealsOf = (state, player) => (state.pile.length === 1 ? pileDeals(state, player) : Array.from({ length: SAMPLED }, (_, k) => determinize(state, player, createRng(k + 1))));

function measured({ log, turn, nodes }) {
  const state = stateAt(log, turn);
  const entry = log.turns[turn - 1];
  const player = state.current;
  const move = legalMoves(state).find((m) => formatCard(state.spec, m.card) === entry.move.card && m.border === entry.move.border - 1);
  const deals = dealsOf(state, player);
  const side = { move, player, nodes };
  const byRule = (measure) => Object.fromEntries(RULES.map((rule) => [rule, measure(rule)]));
  return {
    exact: byRule((rule) => shareWon(deals, side, rule)),
    truth: byRule((rule) => solved(state, side, rule)),
    policy: byRule((rule) => rolled(state, side, rule)),
    end: { winType: log.result.winType, turns: log.turns.length, after: log.turns.length - turn },
  };
}

parentPort.on("message", (task) => parentPort.postMessage(measured(task)));
