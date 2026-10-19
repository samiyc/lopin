import { JOKER, isJoker } from "../../core/cards.js";
import { STATUS, borderStatus } from "../eval/certainty.js";

/**
 * `jokerWin` (Sami, 19/10, JokerWin): a joker is played only when it wins the game. It completes a side, that border
 * becomes won by theorem (`borderStatus`: no finish of the other side beats it), and with the borders already won it
 * makes `adjacent` in a row or the `majority`. Any other joker move is refused — at the root, in the tree's nodes and
 * in the rollouts, for both sides — so it neither spends a joker a natural trips would have spared nor fills the tree
 * with joker moves that win nothing. The solver (`exact`, pile empty) still sees every move, jokers included: the
 * two-joker sides of the kept duels were all begun by it (270 in 9 692 games, none by a tree).
 *
 * Measured on the end-of-game positions (scripts/archive/misjudged-endgames.js): the 1.2's tree overrates its mover by
 * 10.5 points with both jokers hidden, its rollouts keeping, or wasting, the jokers the solver plays.
 */

/** The game seen after `player` lays a joker on `border`: one joker out of their hand, the side completed now. */
function withJoker(state, player, border) {
  const hand = [...state.hands[player]];
  hand.splice(hand.findIndex(isJoker), 1);
  const target = state.borders[border];
  const completedAt = [...target.completedAt];
  completedAt[player] = state.turn;
  const sides = target.sides.map((side, seat) => (seat === player ? [...side, JOKER] : side));
  const jokersPlayed = [...state.jokersPlayed];
  jokersPlayed[player] += 1;
  return {
    ...state,
    hands: state.hands.map((cards, seat) => (seat === player ? hand : cards)),
    borders: state.borders.map((entry, index) => (index === border ? { ...entry, sides, completedAt } : entry)),
    jokersPlayed,
  };
}

/** The longest run of `true` in `flags`. */
function longestRun(flags) {
  let best = 0;
  let run = 0;
  for (const flag of flags) {
    run = flag ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Whether `border` is won for `player` in `state`: claimed, or their full side proven unbeatable. */
function wonBy(state, border, player) {
  const { owner, sides } = state.borders[border];
  if (owner !== null && owner !== undefined) return owner === player;
  return sides[player].length === 3 && borderStatus(state, border, player) === STATUS.won;
}

/** Can winning `border` give `player` the game at all, counting every border not yet lost as won? A cheap first cut. */
function couldWin(state, border, player) {
  const open = state.borders.map(({ owner }, index) => index === border || owner === null || owner === undefined || owner === player);
  return longestRun(open) >= state.spec.adjacent || open.filter(Boolean).length >= state.spec.majority;
}

/** Does a joker laid by `player` on `border` win them the game, by theorem? */
export function jokerWinsGame(state, player, border) {
  if (state.borders[border].sides[player].length !== 2 || !couldWin(state, border, player)) return false;
  const after = withJoker(state, player, border);
  if (!wonBy(after, border, player)) return false;
  const won = after.borders.map((_, index) => index === border || wonBy(after, index, player));
  return longestRun(won) >= state.spec.adjacent || won.filter(Boolean).length >= state.spec.majority;
}

/** `context.jokerWin` for one scoring: `jokerWinsGame` for the player to move, each border asked once. */
export function jokerWinOf(state, player) {
  const known = new Map();
  return (border) => {
    if (!known.has(border)) known.set(border, jokerWinsGame(state, player, border));
    return known.get(border);
  };
}
