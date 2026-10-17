import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { gateOn } from "./gates.js";

/**
 * Round three: Sami's principles from his reading of three games against
 * Stratège 2.0 (docs/strategie.md). Switched on through the strategist's
 * `ideas` set like the others, weighted by `context.weights`.
 *
 * - `trips`: three of a kind in hand (a joker counting as one) gets played —
 *   it empties the hand and brings new cards. Building it is rewarded: a card
 *   joining its lone twin, or opening one of the trips borders (2, 3, 5, 6).
 * - `ends`: a 1 or a 10 does not open a middle border (3, 4, 5): its straight
 *   flush has one way to grow instead of two.
 * - `reserve`: keep free borders — two while the pile is still thick, one near
 *   the end — for the three of a kind or the straight flush the pile may bring.
 * - `connector`: a card does not leave its suited neighbour alone on another
 *   border while both ends of the pair are still possible (8♠ 9♠: 7♠ and 10♠).
 */
export const PRINCIPLES = Object.freeze(["trips", "ends", "reserve", "connector"]);

/** `connector` at 0.6: 53.9 % against strategist 1.1 over 24 000 games; 1.0 did no better. */
export const PRINCIPLE_WEIGHTS = Object.freeze({ trips: 0.3, ends: 0.3, reserve: 0.2, reserveUntilPile: 10, connector: 0.6 });

const TRIPS_BORDERS = new Set([1, 2, 4, 5]);
const isMiddle = (border, count) => Math.abs(border - (count - 1) / 2) <= 1;

/** Cards of `card`'s value in hand besides it, jokers included. */
function twinsInHand({ spec, hand }, card) {
  const others = [...hand];
  others.splice(others.indexOf(card), 1);
  return others.filter((other) => isJoker(other) || valueOf(spec, other) === valueOf(spec, card)).length;
}

/** A lone card of the same value as `card`, alone on `side`. */
const loneTwin = ({ spec }, side, card) => side.length === 1 && !isJoker(side[0]) && valueOf(spec, side[0]) === valueOf(spec, card);

function tripsBonus(context, border, card) {
  if (isJoker(card)) return 0;
  const { weights } = context;
  const side = context.mySides[border];
  const twins = twinsInHand(context, card);
  const joinsTwin = loneTwin(context, side, card) && twins >= 1;
  const opensTrips = side.length === 0 && twins >= 2 && TRIPS_BORDERS.has(border);
  return joinsTwin || opensTrips ? weights.trips : 0;
}

function endsPenalty({ spec, weights, mySides }, border, card) {
  if (isJoker(card) || mySides[border].length > 0 || !isMiddle(border, mySides.length)) return 0;
  const value = valueOf(spec, card);
  return value === 1 || value === spec.values ? -weights.ends : 0;
}

function reservePenalty({ weights, mySides, pile }, border) {
  if (mySides[border].length > 0) return 0;
  const keep = pile >= weights.reserveUntilPile ? 2 : 1;
  const freeAfter = mySides.filter((side) => side.length === 0).length - 1;
  return freeAfter < keep ? -weights.reserve : 0;
}

const onBoard = ({ spec, boardCards }, color, value) => boardCards.some((card) => !isJoker(card) && colorOf(spec, card) === color && valueOf(spec, card) === value);

/** Is `lone` + `card` a suited pair in a row whose both ends are still unseen? */
function openPair(context, lone, card) {
  const { spec } = context;
  if (isJoker(lone) || colorOf(spec, lone) !== colorOf(spec, card) || Math.abs(valueOf(spec, lone) - valueOf(spec, card)) !== 1) return false;
  const low = Math.min(valueOf(spec, lone), valueOf(spec, card)) - 1;
  const high = low + 3;
  const color = colorOf(spec, card);
  return low >= 1 && high <= spec.values && !onBoard(context, color, low) && !onBoard(context, color, high);
}

function connectorPenalty(context, border, card) {
  if (isJoker(card)) return 0;
  const left = context.mySides.some((side, index) => index !== border && side.length === 1 && openPair(context, side[0], card));
  return left ? -context.weights.connector : 0;
}

const BONUSES = Object.entries({ trips: tripsBonus, ends: endsPenalty, reserve: reservePenalty, connector: connectorPenalty });

/** The principles' bonus for placing `card` on `border`, in value units. */
/** The principles `ideas` turns on, as bonus functions. */
export const activePrinciples = (ideas) => BONUSES.filter(([name]) => ideas.has(name)).map(([, bonusOf]) => bonusOf);

export function principlesBonus(context, border, card) {
  const active = gateOn(context, "principles", activePrinciples);
  let bonus = 0;
  for (const bonusOf of active) bonus += bonusOf(context, border, card);
  return bonus;
}
