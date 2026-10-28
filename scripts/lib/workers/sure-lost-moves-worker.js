import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { pileDeals } from "../../../src/sim/mcts/pimc.js";
import { determinize } from "../../../src/sim/search/lookahead.js";
import { moveKey } from "../../../src/sim/search/search.js";

/**
 * A « sure » endgame lost to the rules' gap (scripts/archive/sure-lost-moves.js): every legal move solved at the
 * game's rule (`claim-end`) over the deals its mover cannot tell apart — with one card in the pile every place of
 * it, with more `SAMPLED` random deals —, each with its rank in the tree's visits as the duel logged them. Did
 * another move win more deals, and was it among the tree's first?
 */
const SAMPLED = 12;

const dealsOf = (state, player) => (state.pile.length === 1 ? pileDeals(state, player) : Array.from({ length: SAMPLED }, (_, k) => determinize(state, player, createRng(k + 1))));

/** Each move's deals won at `claim-end`, and how many deals the solver finished within `nodes`. */
function wonByMove(deals, moves, nodes) {
  const wins = new Map(moves.map((move) => [moveKey(move), 0]));
  let solved = 0;
  for (const deal of deals) {
    const solution = solveEndgame(Object.assign(deal, { endMode: "claim-end" }), { moves, maxNodes: nodes });
    if (!solution.complete) continue;
    solved += 1;
    for (const entry of solution.moves) if (entry.value > 0) wins.set(moveKey(entry.move), wins.get(moveKey(entry.move)) + 1);
  }
  return { wins, solved };
}

function measured({ log, turn, nodes }) {
  const state = stateAt(log, turn);
  const entry = log.turns[turn - 1];
  const player = state.current;
  const named = (move) => ({ card: formatCard(state.spec, move.card), border: move.border + 1 });
  const moves = legalMoves(state);
  // The tree's ranking: its candidates by visits (the duel logs a root move's visits as its gain).
  const ranked = [...(entry.candidates ?? [])].sort((a, b) => b.gain - a.gain);
  const rankOf = (move) => {
    const { card, border } = named(move);
    const rank = ranked.findIndex((c) => c.card === card && c.border === border);
    return rank >= 0 ? rank + 1 : null;
  };
  const { wins, solved } = wonByMove(dealsOf(state, player), moves, nodes);
  const share = (move) => (solved > 0 ? wins.get(moveKey(move)) / solved : null);
  return {
    deals: solved,
    played: named(moves.find((m) => named(m).card === entry.move.card && named(m).border === entry.move.border)),
    moves: moves.map((move) => ({ ...named(move), rank: rankOf(move), share: share(move) })).sort((a, b) => (b.share ?? -1) - (a.share ?? -1)),
  };
}

parentPort.on("message", (task) => parentPort.postMessage(measured(task)));
