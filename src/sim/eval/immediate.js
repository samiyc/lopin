import { applyMove } from "../engine/game.js";
import { cloneState } from "../search/lookahead.js";

/**
 * A win at once, under the claim rule (`claim-end`): the move proves enough
 * borders — from the cards on the table alone, so whatever the opponent holds
 * — to make three in a row or a majority, and the mover claims them before
 * the move is over. The pile need not be empty: such positions make
 * mid-game puzzles, hidden cards and all.
 */
export function winsAtOnce(state, move) {
  const player = state.current;
  const next = cloneState(state);
  next.endMode = "claim-end";
  applyMove(next, move);
  return next.over && next.winner === player;
}
