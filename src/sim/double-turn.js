import { applyMove, legalMoves } from "./game.js";
import { cloneState } from "./lookahead.js";

/**
 * The double turn (Sami, 16/10, puzzle #313): a move after which the game goes
 * on but the opponent has no legal move — every side of theirs is full or
 * closed — so they pass and the mover plays again. PURE. Rare, and only near
 * the end; the exact solver plays it (a pass is a move like another to it),
 * the core does not know it.
 */
export function forcesPass(state, move) {
  const next = cloneState(state);
  applyMove(next, move);
  return !next.over && legalMoves(next).length === 0;
}
