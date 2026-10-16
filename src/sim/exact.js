import { solveEndgame } from "./endgame.js";
import { applyMove, legalMoves } from "./game.js";

/**
 * The experimental bot's endgame (since 0.7): once the pile is empty and few
 * cards are left, nothing is hidden any more and the exact solver
 * (`endgame.js`) replaces the search. Up to 8 cards it answers in about
 * 0.1 s (`npm run bench`); at 10 it can take 20 s, more than the page allows.
 *
 * The root moves are tried in the core's order and the first win is kept, so
 * among several wins — or when every move loses, against an opponent who may
 * still slip — the bot plays the one its core prefers.
 *
 * `npm run pivots` (01/10): with the pile just empty, 12 cards in hand, the
 * solver finishes every position within 400 000 positions, 255 ms median and
 * 2.3 s for nine in ten. `nodes` caps a solve past the old 8 cards: one that
 * runs out returns null and the bot searches instead.
 */
export const EXACT = Object.freeze({ maxCards: 8, nodes: 400_000 });

const cardsLeft = (state) => state.hands[0].length + state.hands[1].length;

/**
 * Can the solver take over? With the pile hidden, only once it is empty — so at most 12 cards (6 + 6) are ever
 * left and `exact` past 12 changes nothing. `seen` (Omniscient 1.0, the pile's order known): the hands and the
 * pile together, since the solver plays the draws as the pile lies.
 */
export const exactApplies = (state, maxCards = EXACT.maxCards, seen = false) =>
  seen ? cardsLeft(state) + state.pile.length <= maxCards : state.pile.length === 0 && cardsLeft(state) <= maxCards;

/** The solver's verdict on `game` for its legal `moves`: the winner, or null for a draw. */
function solvedWinner(game, moves) {
  const value = Math.max(...solveEndgame(game, { moves, stopAtWin: true }).moves.map((entry) => entry.value));
  if (value === 0) return null;
  return value > 0 ? game.current : 1 - game.current;
}

/**
 * `simExact` (Sami's 1.3 roadmap, 12/10): a simulation played by `policy`
 * until the solver applies (pile empty, `maxCards` cards or fewer), then the
 * solver's verdict instead of the policy's ending — the core errs in 3.6 % of
 * won endgames, a third of them with the joker.
 */
export function playOutExact(game, policy, maxCards) {
  const guard = game.spec.borders * 6 * 3;
  while (!game.over && game.turn < guard) {
    const moves = legalMoves(game);
    if (moves.length > 0 && exactApplies(game, maxCards)) return solvedWinner(game, moves);
    applyMove(game, moves.length > 0 ? policy.choose(game, moves) : null);
  }
  return game.winner;
}

/**
 * `scored` (the core's `scoreMoves` output) re-rated by the solver: a move's
 * gain becomes its exact value (1 win, 0 draw, -1 loss) plus a hundredth of
 * the core's gain to order equal values; moves left unexamined after the
 * first win rank below every examined one. Null when `maxNodes` ran out.
 */
export function exactScores(state, scored, { maxNodes = Infinity } = {}) {
  const order = [...scored].sort((a, b) => Number(Boolean(a.refused)) - Number(Boolean(b.refused)) || b.gain - a.gain);
  const { complete, moves } = solveEndgame(state, { moves: order.map((entry) => entry.move), stopAtWin: true, maxNodes });
  if (!complete) return null;
  const values = new Map(moves.map(({ move, value }) => [move, value]));
  return scored.map((entry) => {
    const value = values.get(entry.move);
    return { ...entry, gain: (value ?? -3) + entry.gain / 100, exact: value !== undefined };
  });
}
