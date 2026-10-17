import { applyMove, legalMoves } from "../engine/game.js";
import { cloneState } from "../search/lookahead.js";

/**
 * Solving the end of a game exactly. Once the pile is empty nothing is hidden
 * any more — each hand is what the other cannot see — so the rest of the game
 * is a finite game of perfect information: negamax over every legal move,
 * with memory, stopping at the first winning move since nothing beats a win.
 * The game's own end mode is played: under `final` the borders settle at the
 * end in the order they filled; under `claim-end` (the page) a claimed border
 * is closed, so its owner is part of the memo key.
 *
 * Values are seen from the player to move: 1 a win, 0 a draw, -1 a loss.
 */
const cardsLeft = (state) => state.hands[0].length + state.hands[1].length;

/**
 * What decides the rest of the game from here: hands, sides, whose turn, and
 * the ORDER in which sides filled — only the order matters for ties and for
 * the settling order, so positions reached by moves played in another order
 * share one entry.
 */
const sortedText = (cards) => [...cards].sort((a, b) => a - b).join(",");

function keyOf(state) {
  const hands = state.hands.map(sortedText).join("|");
  const filled = [...new Set(state.borders.flatMap((border) => border.completedAt).filter(Number.isFinite))].sort((a, b) => a - b);
  const rank = (turn) => (Number.isFinite(turn) ? filled.indexOf(turn) : "-");
  // The owner too: under the claim rule a border claimed early is closed, which changes the moves.
  const borders = state.borders.map((border) => `${border.sides.map(sortedText).join("/")}@${border.completedAt.map(rank).join("/")}${border.owner ?? ""}`).join(";");
  const key = `${state.current}#${state.passes}#${hands}#${borders}`;
  // The extension: the figures laid, and the sides in the order they were laid (a Rappel takes the last card back).
  if (!state.withFigures) return key;
  const laid = state.borders.map((border) => [border.figures.join(","), border.sides.join("/")].join(":"));
  return [key, ...laid].join(";");
}

function outcome(state, player) {
  if (state.winner === null) return 0;
  return state.winner === player ? 1 : -1;
}

/** Thrown when a solve runs past `maxNodes`: the caller gets `complete: false` instead of a value. */
const OUT_OF_NODES = Symbol("out of nodes");

/** Negamax value of `state` for the player to move, memoised in `memo`. */
function negamax(state, memo, counter) {
  if (state.over) return outcome(state, state.current);
  const key = keyOf(state);
  const known = memo.get(key);
  if (known !== undefined) return known;
  counter.nodes += 1;
  if (counter.nodes > counter.limit) throw OUT_OF_NODES;
  const moves = legalMoves(state);
  let best = -Infinity;
  for (const move of moves.length > 0 ? moves : [null]) {
    const next = cloneState(state);
    applyMove(next, move);
    // The turn always passes to the other player, so their value is the opposite of ours.
    const value = next.over ? outcome(next, state.current) : -negamax(next, memo, counter);
    best = Math.max(best, value);
    if (best === 1) break;
  }
  memo.set(key, best);
  return best;
}

/** The exact value of `move` for the player making it. */
function valueOf(state, move, memo, counter) {
  const next = cloneState(state);
  applyMove(next, move);
  return next.over ? outcome(next, state.current) : -negamax(next, memo, counter);
}

function valueAll(state, candidates, stopAtWin, counter) {
  const memo = new Map();
  const moves = [];
  for (const move of candidates) {
    moves.push({ move, value: valueOf(state, move, memo, counter) });
    if (stopAtWin && moves.at(-1).value === 1) break;
  }
  return moves;
}

/** `valueAll`, or null when it ran out of nodes. */
function tryValueAll(state, candidates, stopAtWin, counter) {
  try {
    return valueAll(state, candidates, stopAtWin, counter);
  } catch (error) {
    if (error !== OUT_OF_NODES) throw error;
    return null;
  }
}

/**
 * Every legal move of `state` with its exact value for the player to move,
 * best first, plus the number of positions examined. Meant for positions
 * with an empty pile (the solver reads the pile as it lies).
 *
 * `moves`: the moves to value, in the order to try them (all legal moves by
 * default). `stopAtWin`: stop at the first winning one — a bot needs a win,
 * not every win; the moves after it are left out of the answer. `maxNodes`:
 * give up past that many positions — the answer is then `{ complete: false }`
 * and nothing else, since a half-solved position proves nothing.
 */
export function solveEndgame(state, { moves: candidates = legalMoves(state), stopAtWin = false, maxNodes = Infinity } = {}) {
  const counter = { nodes: 0, limit: maxNodes };
  const moves = tryValueAll(state, candidates, stopAtWin, counter);
  if (!moves) return { complete: false, nodes: counter.nodes, cardsLeft: cardsLeft(state) };
  moves.sort((a, b) => b.value - a.value);
  return { complete: true, moves, value: moves[0]?.value ?? 0, nodes: counter.nodes, cardsLeft: cardsLeft(state) };
}

/** The moves that reach the best value — the puzzle's solutions. */
export const bestMoves = (solution) => solution.moves.filter((entry) => entry.value === solution.value).map((entry) => entry.move);
