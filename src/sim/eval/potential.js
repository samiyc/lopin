import { JOKER, isJoker, realCardCount, valueOf } from "../../core/cards.js";
import { isFigure } from "../../core/figures.js";

/**
 * What a side of a border is likely to be worth once finished, seen from one
 * player: the value of a formation is its rank (0 for a sum, 4 for the top of
 * the order) plus the sum as a fraction, so a better formation always
 * outweighs a better sum.
 *
 * Cheap on purpose — the simulation plays hundreds of thousands of turns:
 * a finished side is exact, two cards look at every card still unseen, one
 * card looks at the pairs it could make with the hand, an empty side is a
 * constant.
 */
const SPAN = 64;
// A pair not yet placed is worth this much of a placed one; a core may carry its own (`params.pairDiscount`, B3).
export const PAIR_DISCOUNT = 0.9;

/** One valuer per evaluator: it only reads the spec and the evaluator, and a scoring used to rebuild it. */
const valuers = new WeakMap();

export function createValuer(state) {
  const known = valuers.get(state.evaluator);
  if (known?.spec === state.spec) return known.valuer;
  const valuer = buildValuer(state);
  valuers.set(state.evaluator, { spec: state.spec, valuer });
  return valuer;
}

function buildValuer({ spec, evaluator }) {
  // One above the highest sum, so a value's integer part is always its rank.
  const sumScale = 3 * spec.values + 1;
  const average = (spec.values + 1) / 2;
  const toValue = (score) => Math.floor(score / SPAN) + (score % SPAN) / sumScale;
  const value = (cards) => toValue(evaluator.score(cards));
  const cardValue = (card) => (isJoker(card) ? spec.values : valueOf(spec, card));
  return {
    value,
    /** Two placed cards plus one more, without building an array. */
    value3: (side, card) => toValue(evaluator.score3(side[0], side[1], card)),
    best3: bestThirdOf(spec, evaluator, toValue),
    empty: (3 * average) / sumScale,
    single: (card) => (cardValue(card) + 2 * average) / sumScale,
  };
}

/**
 * A6 (Sami, 11/10): the best value any third card could give the pair (a, b),
 * from a table built once per evaluator — whatever its order, joker rule or
 * figure. A pair's potential never exceeds it: the hand's cards and the
 * pile's are third cards, and the pile's mean plus its weighted upside stays
 * under its best (`drawPotentialOf`). `singlePotential` skips a pair that
 * cannot raise its best, with the same result to the last bit.
 */
function bestThirdOf(spec, evaluator, toValue) {
  const real = realCardCount(spec);
  const size = real + 1;
  const thirds = Array.from({ length: real }, (_, card) => card);
  if (spec.jokers > 0) thirds.push(JOKER);
  const indexOf = (card) => (isJoker(card) ? real : card);
  const cardAt = (index) => (index === real ? JOKER : index);
  const bestWith = (a, b) => Math.max(...thirds.map((c) => toValue(evaluator.score3(a, b, c))));
  let table = null;
  const build = () => {
    table = new Float64Array(size * size);
    for (let index = 0; index < size * size; index += 1) table[index] = bestWith(cardAt(Math.floor(index / size)), cardAt(index % size));
  };
  return (a, b) => {
    if (!table) build();
    return table[indexOf(a) * size + indexOf(b)];
  };
}

/**
 * The cards a player cannot see: the deck minus their hand and the board. The
 * opponent's hand is in there — that is what not seeing it means.
 */
export function unseenCards(state, player) {
  // A flat count per card, the jokers last: the deck's own order, which the sums downstream keep.
  const real = realCardCount(state.spec);
  const counts = new Array(real + 1).fill(1);
  counts[real] = state.spec.jokers;
  // A figure (the extension) is never a card to finish a side with: not counted.
  const see = (card) => {
    if (!isFigure(card)) counts[isJoker(card) ? real : card] -= 1;
  };
  state.hands[player].forEach(see);
  for (const border of state.borders) for (const side of border.sides) side.forEach(see);
  return listUnseen(counts, real);
}

/** The counts left, as `entries` (pairs, for the readers that like them) and `cards` and `counts` side by side (the hot loop). */
function listUnseen(counts, real) {
  const [entries, cards, kept] = [[], [], []];
  let total = 0;
  for (let index = 0; index <= real; index += 1) {
    const count = counts[index];
    if (count <= 0) continue;
    const card = index === real ? JOKER : index;
    entries.push([card, count]);
    cards.push(card);
    kept.push(count);
    total += count;
  }
  return { entries, cards, counts: kept, total };
}

/** The unseen cards as two arrays side by side; built from `entries` once when a context was made by hand. */
function columns(unseen) {
  if (!unseen.cards) Object.assign(unseen, { cards: unseen.entries.map(([card]) => card), counts: unseen.entries.map(([, count]) => count) });
  return unseen;
}

/**
 * The memory of pair potentials (`drawPotential`), for one view of one scoring:
 * a stamp in two tables shared by every scoring (npm run features, 05/10: a Map
 * per view and per scoring cost a fifth of the core's time). An entry is the
 * memo's own while it carries its stamp; another scoring, even one nested
 * inside, writes under a stamp of its own and only causes a miss.
 */
const PAIR_KEYS = 64 * 64 * 2;
const PAIR_VALUES = new Float64Array(PAIR_KEYS);
const PAIR_STAMPS = new Uint32Array(PAIR_KEYS);
let stamps = 0;

export function createPairMemo() {
  stamps += 1;
  if (stamps >= 0xffffffff) {
    PAIR_STAMPS.fill(0);
    stamps = 1;
  }
  return stamps;
}

/**
 * `context`: { valuer, hand, unseen, draws, jokerAllowed(side), memo? (`createPairMemo`), lite? }.
 * `lite` (B1, 05/10): a side of one card is worth that card alone, without trying
 * every pair the hand could make with it — a lighter core for the rollouts.
 */
export function sidePotential(side, context) {
  if (side.length >= 3) return context.valuer.value(side);
  if (side.length === 2) return pairPotential(side, context);
  if (side.length === 1) return context.lite ? context.valuer.single(side[0]) : singlePotential(side, context);
  return context.valuer.empty;
}

const usable = (card, jokerOk) => jokerOk || !isJoker(card);

/** `skip`: the index of a hand card already on `side`, left out without copying the hand. */
function pairPotential(side, context, skip = -1) {
  const jokerOk = context.jokerAllowed(side);
  const { hand } = context;
  let best = -Infinity;
  for (let i = 0; i < hand.length; i += 1) {
    if (i !== skip && usable(hand[i], jokerOk)) best = Math.max(best, context.valuer.value3(side, hand[i]));
  }
  return Math.max(best, drawPotential(side, context, jokerOk));
}

/**
 * Completing from the draw: the average over unseen cards, plus the best
 * upside of any formation weighted by the chance of drawing one of its outs.
 *
 * It depends only on the two cards (the unseen cards and the draws are fixed
 * for one scoring), yet one scoring asks for the same pair dozens of times:
 * a context may carry a `memo` (`createPairMemo`), fresh for each scoring, to answer once.
 */
function drawPotential(side, context, jokerOk) {
  const { memo } = context;
  if (!memo) return drawPotentialOf(side, context, jokerOk);
  // A number rather than a string: cards run from -1 (joker) up, well under 63. No array for the order: this runs millions of times.
  const a = side[0];
  const b = side[1];
  const key = (a < b ? (a + 1) * 64 + b + 1 : (b + 1) * 64 + a + 1) * 2 + Number(jokerOk);
  if (PAIR_STAMPS[key] === memo) return PAIR_VALUES[key];
  const value = drawPotentialOf(side, context, jokerOk);
  PAIR_STAMPS[key] = memo;
  PAIR_VALUES[key] = value;
  return value;
}

/** Scratch for `drawPotentialOf`, reset on each call: it runs too often to allocate two arrays each time. */
const OUTS = new Float64Array(5);
const BEST_OF = new Float64Array(5);

function drawPotentialOf(side, { valuer, unseen, draws }, jokerOk) {
  const outs = OUTS.fill(0);
  const bestOf = BEST_OF.fill(0);
  let mean = 0;
  let total = 0;
  const { cards, counts } = columns(unseen);
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    if (!usable(card, jokerOk)) continue;
    const count = counts[i];
    const value = valuer.value3(side, card);
    const rank = Math.floor(value);
    outs[rank] += count;
    bestOf[rank] = Math.max(bestOf[rank], value);
    mean += value * count;
    total += count;
  }
  // Nothing left that could finish it: the side is as good as dead.
  if (total === 0) return 0;
  return mean / total + upsideOf(mean / total, unseen.total, draws);
}

/**
 * The chance of drawing one of `outs` cards out of `total` unseen in `draws`
 * draws, worked out once per (total, draws, outs) and kept: the same few
 * dozen values are asked millions of times (NaN until first asked). Each
 * stays under 64: 46 unseen cards at most, 29 draws.
 */
const CHANCES = new Float64Array(64 * 64 * 64).fill(Number.NaN);

function chanceOf(outs, total, draws) {
  // A deck bigger than the printed one would overflow the table: worked out each time.
  if (total >= 64 || draws >= 64) return 1 - (1 - outs / total) ** draws;
  const index = (total * 64 + draws) * 64 + outs;
  let chance = CHANCES[index];
  if (Number.isNaN(chance)) {
    chance = 1 - (1 - outs / total) ** draws;
    CHANCES[index] = chance;
  }
  return chance;
}

/** The best upside of any formation over the mean, weighted by the chance of drawing one of its outs (read from the scratch). */
function upsideOf(mean, unseenTotal, draws) {
  let upside = 0;
  for (let rank = 1; rank < OUTS.length; rank += 1) upside = Math.max(upside, chanceOf(OUTS[rank], unseenTotal, draws) * (BEST_OF[rank] - mean));
  return upside;
}

/** The pair `singlePotential` tries, refilled for each hand card: nothing below keeps it (value3, the joker gate and the memo key read its two cards). */
const PAIR = [0, 0];

function singlePotential(side, context) {
  const jokerOk = context.jokerAllowed(side);
  let best = context.valuer.single(side[0]);
  const discount = context.params?.pairDiscount ?? PAIR_DISCOUNT;
  // The hand minus the card being paired: its index is skipped, not copied out.
  const { hand, valuer } = context;
  PAIR[0] = side[0];
  for (let i = 0; i < hand.length; i += 1) {
    // A6: a pair whose best third card could not beat `best` leaves the max as it is.
    // The margin covers a float mean that rounds a hair above its largest term.
    if (!usable(hand[i], jokerOk) || discount * (valuer.best3(side[0], hand[i]) + 1e-9) <= best) continue;
    PAIR[1] = hand[i];
    best = Math.max(best, discount * pairPotential(PAIR, context, i));
  }
  return best;
}
