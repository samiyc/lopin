import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { applyMove, legalMoves } from "../../../src/sim/engine/game.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { cloneState, determinize, unseenList } from "../../../src/sim/search/lookahead.js";

/**
 * A misjudged endgame solved over the deals its mover cannot tell apart (scripts/archive/misjudged-endgames.js
 * `--solve`): with one card in the pile every place of it, with more `SAMPLED` random deals. Each deal is played at the
 * page's rule after the logged move and solved exactly, the pile read as it lies: the share won is what the mover
 * should have estimated, with perfect play on both sides.
 */
const SAMPLED = 12;
const NODES = 1_500_000;

/** Deals of the hidden cards: one per place of the single pile card, or `SAMPLED` random ones. */
function dealsOf(state, player) {
  if (state.pile.length !== 1) return Array.from({ length: SAMPLED }, (_, k) => determinize(state, player, createRng(k + 1)));
  const unseen = unseenList(state, player);
  return unseen.map((card, k) => {
    const deal = cloneState(state);
    deal.pile = [card];
    deal.hands[1 - player] = unseen.filter((_, j) => j !== k);
    return deal;
  });
}

/** The mover's exact result after `move` on `deal` (1 won, 0 drawn, -1 lost), null if the solver ran out. */
function solved(deal, move, player) {
  const game = Object.assign(cloneState(deal), { endMode: "claim-end" });
  applyMove(game, move);
  if (game.over) return game.winner === player ? 1 : -1;
  const solution = solveEndgame(game, { stopAtWin: true, maxNodes: NODES });
  return solution.complete ? -solution.value : null;
}

parentPort.on("message", ({ log, turn }) => {
  const state = stateAt(log, turn);
  const entry = log.turns[turn - 1];
  const player = state.current;
  const move = legalMoves(state).find((m) => formatCard(state.spec, m.card) === entry.move.card && m.border === entry.move.border - 1);
  const values = dealsOf(state, player).map((deal) => solved(deal, move, player)).filter((value) => value !== null);
  parentPort.postMessage({ solved: values.length, exact: values.filter((value) => value > 0).length / Math.max(1, values.length) });
});
