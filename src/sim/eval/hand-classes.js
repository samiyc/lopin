import { buildDeck, colorOf, isJoker, valueOf } from "../../core/cards.js";
import { createRng } from "../../core/random.js";

/**
 * Starting hands sorted into weak, medium and strong, about a tenth of the
 * hands at each end (Sami, evol-exp-080; thresholds from an exact count of
 * the Classique's 5 245 786 hands):
 *
 * - weak, 9.9 %: no joker, no two suited cards in a row, no three cards of
 *   one colour, at most one pair, and the six values summing to 36 or less;
 * - strong, 8.9 %: at least one start — a pair, two suited cards in a row,
 *   three cards of one colour, or a joker — and the values summing to 44 or
 *   more, a joker counting as the top value;
 * - medium: the rest.
 *
 * "Every card under 6, no pair" holds no hand at all: six cards of five
 * values always pair up. The sum keeps the idea of low cards.
 */
export const HAND_CLASSES = Object.freeze({ weakMaxSum: 36, strongMinSum: 44 });

export const HAND_CLASS_IDS = Object.freeze(["weak", "medium", "strong"]);

/** What a starting hand already holds: its pairs, suited neighbours, longest colour, jokers and sum. */
function featuresOf(spec, hand) {
  const real = hand.filter((card) => !isJoker(card));
  const jokers = hand.length - real.length;
  const values = real.map((card) => valueOf(spec, card));
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const colours = new Map();
  for (const card of real) colours.set(colorOf(spec, card), (colours.get(colorOf(spec, card)) ?? 0) + 1);
  const suitedNeighbours = real.some((a) => real.some((b) => colorOf(spec, a) === colorOf(spec, b) && valueOf(spec, b) === valueOf(spec, a) + 1));
  return {
    jokers,
    pairs: [...counts.values()].filter((count) => count >= 2).length,
    suitedNeighbours,
    longestColour: Math.max(0, ...colours.values()),
    sum: values.reduce((total, value) => total + value, 0) + jokers * spec.values,
  };
}

/** A start the pile can build on: a pair, suited neighbours, three of a colour, or a joker. */
const hasStart = ({ jokers, pairs, suitedNeighbours, longestColour }) => pairs > 0 || suitedNeighbours || longestColour >= 3 || jokers > 0;
/** Nothing to build on but at most one pair. */
const isBare = ({ jokers, pairs, suitedNeighbours, longestColour }) => jokers === 0 && !suitedNeighbours && longestColour < 3 && pairs <= 1;

/** "weak", "medium" or "strong" (`HAND_CLASSES`). */
export function handClass(spec, hand) {
  const features = featuresOf(spec, hand);
  if (hasStart(features) && features.sum >= HAND_CLASSES.strongMinSum) return "strong";
  return isBare(features) && features.sum <= HAND_CLASSES.weakMaxSum ? "weak" : "medium";
}

/** The starting hands a deck deals: the first player's six cards, then the second's (`createGame`). */
export const startingHands = (spec, deck) => [deck.slice(0, spec.handSize), deck.slice(spec.handSize, 2 * spec.handSize)];

/**
 * A deck whose first player starts with a hand of class `wanted`, the same
 * for the same seed: decks are shuffled from the seed until one fits. About
 * one in ten does, at either end.
 */
export function dealFor(spec, seed, wanted) {
  const rng = createRng(seed);
  for (;;) {
    const deck = rng.shuffle(buildDeck(spec));
    if (handClass(spec, startingHands(spec, deck)[0]) === wanted) return deck;
  }
}
