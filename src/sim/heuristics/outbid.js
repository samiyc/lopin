import { isJoker, valueOf } from "../../core/cards.js";

/**
 * Two of Sami's ideas from his own games (02/10), on the first card of a
 * border — where `counter` (ideas.js), which compares shapes, says nothing:
 *
 * - `outbid`: on a border where the opponent has one card and I have none,
 *   answer it one notch higher (a 3 against a 2). If both sides end the same
 *   shape — two trips, two suited runs — the higher sum takes the border.
 *   With `outbidWide`, only while the opponent has started more borders than
 *   me: the moment Sami does it, filling his empty side of their open borders.
 * - `exposure`: opening a border nobody has touched with a v offers the
 *   opponent that same answer, a v + 1. It costs in proportion to the odds
 *   that they hold one now, read from the cards I have not seen.
 */

/** The opponent has started more borders than I have. */
const outnumbered = (mySides, theirSides) => theirSides.filter((side) => side.length > 0).length > mySides.filter((side) => side.length > 0).length;

export function outbidBonus({ spec, weights, mySides, theirSides }, border, card) {
  const theirs = theirSides[border];
  if (theirs.length !== 1 || isJoker(theirs[0]) || isJoker(card)) return 0;
  if (valueOf(spec, card) !== valueOf(spec, theirs[0]) + 1) return 0;
  if (weights.outbidWide && !outnumbered(mySides, theirSides)) return 0;
  return weights.outbid;
}

/** The odds that a hand of `hand` cards, drawn from `total` unseen, holds one of `wanted` of them. */
export function holdsOne(wanted, total, hand) {
  let none = 1;
  for (let i = 0; i < hand && none > 0; i += 1) none *= Math.max(0, total - wanted - i) / (total - i);
  return 1 - none;
}

export function exposurePenalty({ spec, weights, unseen, theirSides, theirHand }, border, card) {
  if (theirSides[border].length > 0 || isJoker(card)) return 0;
  const above = valueOf(spec, card) + 1;
  if (above > spec.values) return 0;
  const wanted = unseen.entries.reduce((count, [unseenCard, n]) => (!isJoker(unseenCard) && valueOf(spec, unseenCard) === above ? count + n : count), 0);
  return wanted === 0 ? 0 : -weights.exposure * holdsOne(wanted, unseen.total, theirHand);
}
