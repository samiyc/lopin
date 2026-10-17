import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { BOTS } from "../../../src/sim/bots.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { bestMoves, solveEndgame } from "../../../src/sim/eval/endgame.js";

/**
 * Puzzle hunting: solves each endgame given (`log`, `turn`) exactly and keeps
 * those that are won for the side to move but only through few of its moves.
 */
const text = (state, move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;

function examine(log, turn, share) {
  const state = stateAt(log, turn);
  if (state.pile.length > 0 || state.over || legalMoves(state).length < 4) return null;
  const solution = solveEndgame(state);
  const winning = bestMoves(solution);
  if (solution.value !== 1 || winning.length / solution.moves.length > share) return null;
  const coreMove = BOTS.strategist(createRng(1)).choose(state, legalMoves(state));
  const coreWins = winning.some((move) => move.card === coreMove.card && move.border === coreMove.border);
  return {
    turn,
    cardsLeft: solution.cardsLeft,
    moves: solution.moves.length,
    solutions: winning.map((move) => text(state, move)),
    coreMove: text(state, coreMove),
    coreFails: !coreWins,
    nodes: solution.nodes,
  };
}

parentPort.on("message", ({ items, share, seconds }) => {
  const until = Date.now() + seconds * 1000;
  const found = [];
  for (const { index, log, turn } of items) {
    if (Date.now() > until) break;
    const puzzle = examine(log, turn, share);
    if (puzzle) found.push({ index, ...puzzle });
  }
  parentPort.postMessage(found);
});
