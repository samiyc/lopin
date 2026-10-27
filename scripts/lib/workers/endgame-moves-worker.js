import { parentPort } from "node:worker_threads";
import { isJoker } from "../../../src/core/cards.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { engineFor, rolloutPolicyOf, strategistBot } from "../../../src/sim/bots.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { coreOf } from "../../../src/sim/heuristics/experimental.js";
import { pileDeals, pimcRated } from "../../../src/sim/mcts/pimc.js";
import { cloneState, determinize } from "../../../src/sim/search/lookahead.js";
import { moveKey } from "../../../src/sim/search/search.js";

/**
 * One end-of-game position of a kept duel judged move by move (scripts/archive/endgame-moves.js): the 1.2's tree
 * searched again (its visits and rates per root candidate), the core's ranking, the rollout policy's move, and every
 * legal move solved exactly over the same deals of the hidden cards — every place of the pile card when the pile holds
 * one, `SAMPLED` random deals otherwise. A move's exact value is its share of those deals won with perfect play on both
 * sides once the deal is known (PIMC: the opponent is credited with seeing the cards too).
 */
const SAMPLED = 12;
// ~400 bytes a node: 3 million keep a worker under ~1.3 GB (measured 20/10: 2.46 GB at 6 million).
const NODES = 3_000_000;
const ENGINE = "ismcts+widen=7+depth=5+core=stfig6+exact=12";

/** Every place of the pile card (pimc.js, the deals EndPimc3 plays), or `SAMPLED` random deals with two in the pile. */
const dealsOf = (state, player) => (state.pile.length === 1 ? pileDeals(state, player) : Array.from({ length: SAMPLED }, (_, k) => determinize(state, player, createRng(k + 1))));

/** The mover's result per move on `deal` (1 won, else 0), one solve for every move so they share the memo; null if it ran out. */
function solvedDeal(deal, moves) {
  const game = Object.assign(cloneState(deal), { endMode: "claim-end" });
  const solution = solveEndgame(game, { moves, maxNodes: NODES });
  if (!solution.complete) return null;
  const won = new Map(solution.moves.map((entry) => [moveKey(entry.move), entry.value > 0 ? 1 : 0]));
  return moves.map((move) => won.get(moveKey(move)));
}

/** Each move's share of the deals won; all null at the first deal the solver cannot finish (the rest is not tried). */
function exactValues(state, moves, player) {
  const solved = [];
  for (const deal of dealsOf(state, player)) {
    const values = solvedDeal(deal, moves);
    if (!values) return moves.map(() => null);
    solved.push(values);
  }
  return moves.map((_, k) => solved.reduce((sum, values) => sum + values[k], 0) / solved.length);
}

/** The core's moves, best first (`scoreMoves` keeps the legal moves' order). */
export const coreRanking = (state, moves) =>
  [...strategistBot(createRng(1), coreOf("stfig6")).scoreMoves(state, moves)].sort((a, b) => b.gain - a.gain).map((entry) => moveKey(entry.move));

function treeOf(state, moves, seed, budget) {
  const search = engineFor(`${ENGINE}@${budget}`)(createRng(seed)).searchFor(state, moves, {});
  for (let i = 0; i < budget; i += 1) search.step();
  return search.tree().children;
}

/** What a move does: a joker, the side's third card, a fresh border. */
function shapeOf(state, move, player) {
  const side = state.borders[move.border].sides[player];
  return { joker: isJoker(move.card), fills: side.length === 2, opens: side.length === 0 };
}

/** `--pimc-cost`: EndPimc3's choice timed on a kept position, the tree's visits read back from the bench (no search). */
function pimcCost(state, { k, nodes, visits }) {
  const rated = legalMoves(state).map((move) => ({ move, gain: visits[moveKey(move)] ?? 0 }));
  const started = performance.now();
  const rerated = pimcRated(state, rated, k, { maxNodes: nodes });
  const ms = performance.now() - started;
  const chosen = rerated && rerated.reduce((a, b) => (b.gain > a.gain ? b : a)).move;
  return { ms, complete: Boolean(rerated), chosen: chosen ? moveKey(chosen) : null };
}

parentPort?.on("message", ({ log, turn, budget, cost }) => {
  const state = stateAt(log, turn);
  if (cost) {
    parentPort.postMessage(pimcCost(state, cost));
    return;
  }
  const player = state.current;
  const moves = legalMoves(state);
  const children = treeOf(state, moves, turn * 7919 + 1, budget);
  const core = coreRanking(state, moves);
  const policyMove = moveKey(rolloutPolicyOf(coreOf("stfig6"))(createRng(1)).choose(state, moves));
  const exact = exactValues(state, moves, player);
  const total = [...children.values()].reduce((sum, child) => sum + child.visits, 0);
  const rows = moves.map((move, k) => {
    const key = moveKey(move);
    const child = children.get(key);
    return { key, exact: exact[k], visits: child?.visits ?? 0, share: (child?.visits ?? 0) / Math.max(1, total), rate: child?.visits ? child.wins / child.visits : null, coreRank: core.indexOf(key) + 1, policy: key === policyMove, ...shapeOf(state, move, player) };
  });
  parentPort.postMessage({ pile: state.pile.length, moves: rows });
});
