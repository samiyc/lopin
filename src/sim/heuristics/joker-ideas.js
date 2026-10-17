import { colorOf, isJoker, valueOf } from "../../core/cards.js";

/**
 * Where to put a joker (Sami, 02/10, from `npm run jokers` on the kept
 * games). The `joker` habit (strategist.js) only lets one complete trips; these
 * ideas weigh where — the first bonuses a joker ever gets, since `ideasBonus`
 * only reads real cards.
 *
 * - `jokerFull`: facing a full side, the target is known — in the kept games
 *   its player wins the border 99 % of the time, the game 74 % (62 % for any
 *   joker). Earns `jokerFull`.
 * - `jokerWait`: facing a side still open costs `jokerWait` × the share of it
 *   still to come (a third per missing card).
 * - `jokerMid`: trips of 4 to 7 earn `jokerMid`: on mid-range trips a joker
 *   spares a suit the real card would have cut (Sami's reading; the games
 *   show 94 % of borders won against 91 % at the ends).
 * - `jokerRuns`: the habit also lets a joker complete a suited run.
 * - `jokerTrap` (Sami's trap): with a joker in hand, the second card of a pair
 *   whose last two real cards are already on the board earns `jokerTrap`. The
 *   pair looks dead to the opponent; the joker makes it trips. In the kept
 *   games such pairs win their border 78 % of the time, live ones 74 %.
 */
export const JOKER_IDEAS = Object.freeze(["jokerFull", "jokerWait", "jokerMid", "jokerRuns", "jokerTrap"]);

const realCards = (side) => side.filter((card) => !isJoker(card));

/** Two real suited cards, distinct, within two values: a joker makes them a straight flush. */
export function jokerCompletesRun(spec, side) {
  const real = realCards(side);
  if (side.length !== 2 || real.length !== 2 || colorOf(spec, real[0]) !== colorOf(spec, real[1])) return false;
  const gap = Math.abs(valueOf(spec, real[0]) - valueOf(spec, real[1]));
  return gap >= 1 && gap <= 2;
}

/** The joker ideas' bonus for a joker on my side `side` of `border`. */
export function jokerBonus({ spec, ideas, weights, theirSides }, side, border) {
  if (!ideas || !theirSides) return 0;
  const theirs = theirSides[border].length;
  let bonus = 0;
  if (ideas.has("jokerFull") && theirs === 3) bonus += weights.jokerFull;
  if (ideas.has("jokerWait")) bonus -= (weights.jokerWait * (3 - theirs)) / 3;
  if (ideas.has("jokerMid") && midTrips(spec, side)) bonus += weights.jokerMid;
  return bonus;
}

/** Two real cards of one value between 4 and 7: the joker would make mid-range trips. */
function midTrips(spec, side) {
  const values = realCards(side).map((card) => valueOf(spec, card));
  return values.length === 2 && values[0] === values[1] && values[0] >= 4 && values[0] <= 7;
}

/** The trap's bonus for a real `card` added to my side `mine` (ideas.js). */
export function jokerTrapBonus({ spec, ideas, weights, hand, boardCards }, mine, card) {
  if (!ideas.has("jokerTrap") || mine.length !== 1 || isJoker(mine[0]) || !hand.some(isJoker)) return 0;
  const value = valueOf(spec, card);
  if (valueOf(spec, mine[0]) !== value) return 0;
  const seen = [...boardCards, ...hand].filter((other) => !isJoker(other) && valueOf(spec, other) === value).length;
  return seen === spec.colors ? weights.jokerTrap : 0;
}
