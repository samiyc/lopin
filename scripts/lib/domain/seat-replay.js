import { stateAt } from "../../../src/replay/core/log.js";
import { isClaimable } from "../../../src/sim/eval/certainty.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { EXACT } from "../../../src/sim/eval/exact.js";
import { checkVictory } from "../../../src/sim/engine/settle.js";

/**
 * The seat questions that need a kept game rebuilt (`npm run seats -- --claims | --tempo N`, docs/sieges.md).
 */

/**
 * After the last move, could the loser have claimed a victory too? The mover claims first (`claim-end`), so a
 * double victory goes to the mover: the claim order decides it. The loser's claims are checked on the final table.
 */
export function doubleVictory(log) {
  const state = stateAt(log, log.turns.length + 1);
  if (state.winner === null) return false;
  const loser = 1 - state.winner;
  const owners = state.borders.map((border, index) => (border.owner === null && isClaimable(state, index, loser) ? loser : border.owner));
  const board = { spec: state.spec, borders: owners.map((owner) => ({ owner })), winner: null, over: false };
  return checkVictory(board, loser).winner === loser;
}

const winnerOf = (value, toMove) => {
  if (value === 0) return null;
  return value === 1 ? toMove : 1 - toMove;
};

/** The solver's winner after `turn` moves, with the player to move as played or swapped; undefined past `EXACT.nodes`. */
function solvedWinner(log, turn, swap) {
  const state = stateAt(log, turn + 1);
  if (swap) state.current = 1 - state.current;
  const solution = solveEndgame(state, { stopAtWin: true, maxNodes: EXACT.nodes });
  return solution.complete ? winnerOf(solution.value, state.current) : undefined;
}

/**
 * The tempo once the pile is empty (after 30 moves, the first player to move): the solved winner as played and with
 * the other player to move. A zugzwang would show as games the mover loses only because it must move.
 */
export const tempoAt = (log, turn = 30) => ({ asPlayed: solvedWinner(log, turn, false), swapped: solvedWinner(log, turn, true), toMove: stateAt(log, turn + 1).current });
