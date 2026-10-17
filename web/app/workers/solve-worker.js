import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";

/**
 * The puzzles' solver thread: the deepest endgames take seconds, and the page
 * must not freeze meanwhile. In: `{ id, log }`, a log whose last position is
 * the one to solve. Out: `{ id, moves: [{ card: "7♥", border: 3, value }] }`,
 * best first, values for the player to move (1 win, 0 draw, -1 loss).
 */
onmessage = ({ data: { id, log } }) => {
  const state = stateAt(log, log.turns.length + 1);
  const solution = solveEndgame(state);
  const moves = solution.moves.map(({ move, value }) => ({ card: formatCard(state.spec, move.card), border: move.border + 1, value }));
  postMessage({ id, moves });
};
