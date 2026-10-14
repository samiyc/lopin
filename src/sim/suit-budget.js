import { colorOf, isJoker } from "../core/cards.js";

/**
 * The suit budget (Sami, 14/10): opening a third border in hearts when 8
 * hearts out of 10 are already seen asks for cards that will not come. A
 * side's own potential (potential.js) already counts its outs among the unseen
 * cards, but each side counts all of them as its own: two of my sides on the
 * same suit want the same few cards. This idea weighs my sides on a suit
 * together.
 *
 * - A side is on suit S when its border is undecided, it holds 1 or 2 cards
 *   and every real card on it is of suit S (a joker has no suit); it needs
 *   3 − its length more cards.
 * - What I can expect of S: my cards of S in hand, plus the unseen cards of S
 *   times my share of the draws (my draws over the unseen cards: about half
 *   the pile is mine, the rest of the unseen sits in the opponent's hand or
 *   comes to them).
 * - The shortfall of S is the need over the expectation, never negative; a
 *   move is worth −`suitBudget` × the change it makes to the shortfalls.
 *
 * Pure. The needs and the expectations are worked out once per scoring (the
 * scoring's `memo`): the core plays the rollouts too.
 */
const KEY = "suitBudget";

/** The suit a side is on, or −1: undecided, 1 or 2 cards, every real card of one suit, at least one real card. */
function suitOfSide(spec, side) {
  if (side.length === 0 || side.length >= 3) return -1;
  let suit = -1;
  for (const card of side) {
    if (isJoker(card)) continue;
    const color = colorOf(spec, card);
    if (suit !== -1 && color !== suit) return -1;
    suit = color;
  }
  return suit;
}

/** Each suit's need and expectation before the move, once per scoring. */
function budgetOf(context) {
  const cached = context.memo?.get(KEY);
  if (cached) return cached;
  const { spec, mySides, owners } = context;
  const need = new Array(spec.suits.length).fill(0);
  const undecided = (border) => owners?.[border] === null || owners?.[border] === undefined;
  const onSuit = mySides.map((side, border) => (undecided(border) ? suitOfSide(spec, side) : -1));
  onSuit.forEach((suit, border) => {
    if (suit >= 0) need[suit] += 3 - mySides[border].length;
  });
  const budget = { need, expect: expectations(context), onSuit };
  context.memo?.set(KEY, budget);
  return budget;
}

/** What I can expect of each suit: my cards of it in hand, plus my share of the draws times its unseen cards. */
function expectations({ spec, hand, unseen, pile }) {
  const expect = new Array(spec.suits.length).fill(0);
  for (const card of hand) if (!isJoker(card)) expect[colorOf(spec, card)] += 1;
  const share = unseen.total > 0 ? Math.min(1, Math.ceil(pile / 2) / unseen.total) : 0;
  const { cards, counts } = unseen;
  for (let i = 0; i < cards.length; i += 1) if (!isJoker(cards[i])) expect[colorOf(spec, cards[i])] += counts[i] * share;
  return expect;
}

const shortfall = (need, expect) => Math.max(0, need - expect);

/**
 * The suit the side is on once `card` joins it, or −1 — `suitOfSide` of side + card without building the array:
 * this runs for every move of every rollout.
 */
function suitWith(spec, side, card, color) {
  if (side.length >= 2) return -1;
  const first = side.length === 1 ? side[0] : null;
  if (first === null || isJoker(first)) return color;
  const firstColor = colorOf(spec, first);
  return color === -1 || color === firstColor ? firstColor : -1;
}

/** One suit's change in shortfall when the move takes `card` (of `color`) from the hand onto a side on `was`, now on `now`. */
function changeOf(budget, suit, { color, was, now, length }) {
  const { need, expect } = budget;
  let [needAfter, expectAfter] = [need[suit], expect[suit]];
  if (suit === color) expectAfter -= 1;
  if (suit === was) needAfter -= 3 - length;
  if (suit === now) needAfter += 2 - length;
  return shortfall(needAfter, expectAfter) - shortfall(need[suit], expect[suit]);
}

/** The suit budget's bonus for placing `card` on my side of `border`: −weight × the change in the shortfalls. */
export function suitBudgetBonus(context, border, card) {
  const { spec, mySides, weights } = context;
  const budget = budgetOf(context);
  const side = mySides[border];
  const color = isJoker(card) ? -1 : colorOf(spec, card);
  const move = { color, was: budget.onSuit[border], now: suitWith(spec, side, card, color), length: side.length };
  const change = touchedChange(budget, move);
  return change === 0 ? 0 : -weights.suitBudget * change;
}

/** The change summed over the suits the move touches, each once: the card's own (it leaves my hand), the side's before and after. */
function touchedChange(budget, move) {
  const { color, was, now } = move;
  let change = color >= 0 ? changeOf(budget, color, move) : 0;
  if (was >= 0 && was !== color) change += changeOf(budget, was, move);
  if (now >= 0 && now !== color && now !== was) change += changeOf(budget, now, move);
  return change;
}
