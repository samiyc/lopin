import { unseenCards } from "./potential.js";

/**
 * What a player has seen of the hidden cards by peeking at the pile (a seat compensation, `seat-rules.js`): how
 * many cards from the top they know, and which cards they know the opponent holds — the ones they saw before the
 * opponent drew them. Only the first player peeks, at the start of their turns while the compensation holds.
 *
 * Bots read it, the rules never do: a claim is proved from the table alone (`certainty.js`). `determinize` keeps
 * the known cards where they are (`dealKnowing`), and the core counts the cards it is about to draw as cards of its
 * hand (`knownCards`). `state.known` is replaced, never mutated, so a cheap clone can share it.
 */
export const startKnowledge = () => [
  { top: 0, held: [] },
  { top: 0, held: [] },
];

const cardsInPlay = (state) => state.borders.reduce((sum, border) => sum + border.sides[0].length + border.sides[1].length, 0);

/** The first player's turn number is `turn / 2 + 1` (passes come in turn too); `claim`: no border won yet. */
function peekDue(state, { turns, untilClaim, inPlay }) {
  if (Math.floor(state.turn / 2) + 1 > turns) return false;
  if (untilClaim && state.borders.some((border) => border.owner !== null)) return false;
  return cardsInPlay(state) < inPlay;
}

/** At the start of a turn of the first player, while the compensation holds: they look at the top of the pile. */
export function peekIfDue(state) {
  const { peek } = state.seat;
  if (state.current !== 0 || state.over || !peekDue(state, peek)) return;
  const top = Math.min(state.pile.length, Math.max(peek.cards, state.known[0].top));
  if (top !== state.known[0].top) state.known = [{ ...state.known[0], top }, state.known[1]];
}

const without = (cards, card) => {
  const rest = [...cards];
  rest.splice(rest.indexOf(card), 1);
  return rest;
};

/** What `seat` still knows once `player` laid `card` and drew `drawn` (null: the pile was empty). */
function afterMove(seen, seat, { player, card, drawn }) {
  let { top, held } = seen;
  if (seat !== player && held.includes(card)) held = without(held, card);
  if (drawn !== null && top > 0) {
    top -= 1;
    if (seat !== player) held = [...held, drawn];
  }
  return top === seen.top && held === seen.held ? seen : { top, held };
}

/** A card laid by `player`, then the card they drew: what each seat still knows of the hidden cards. */
export function noteMove(state, player, card, drawn) {
  state.known = state.known.map((seen, seat) => afterMove(seen, seat, { player, card, drawn }));
}

/** Whether `player` knows any hidden card: false in the printed game. */
export const knowsHidden = (state, player) => Boolean(state.known) && (state.known[player].top > 0 || state.known[player].held.length > 0);

/** The top `count` cards of the pile, in the order they will be drawn. */
const topCards = (state, count) => state.pile.slice(state.pile.length - count).reverse();

/**
 * The cards `player` (to move) knows: `mine`, the ones they will draw — the top card after this move, then every
 * other one; `theirs`, the ones the opponent holds or will draw next. Null when they know none.
 */
export function knownCards(state, player) {
  if (!knowsHidden(state, player)) return null;
  const { top, held } = state.known[player];
  const next = topCards(state, top);
  return { mine: next.filter((_, i) => i % 2 === 0), theirs: [...held, ...next.filter((_, i) => i % 2 === 1)] };
}

/** `unseen` (`potential.js`'s shape) without `cards`, in the same order. */
export function unseenWithout(unseen, cards) {
  const counts = new Map(unseen.entries);
  for (const card of cards) counts.set(card, counts.get(card) - 1);
  const entries = unseen.entries.map(([card]) => [card, counts.get(card)]).filter(([, left]) => left > 0);
  return { entries, cards: entries.map(([card]) => card), counts: entries.map(([, left]) => left), total: entries.reduce((sum, [, left]) => sum + left, 0) };
}

/**
 * What the core counts for `player` (bots.js `views`): the unseen cards, its draws to come, the cards it knows it
 * will draw (`next`, weighed as cards of its hand), the opponent's known cards and draws to come. In the printed
 * game, the counts the core always made.
 */
export function coreCounts(state, player) {
  const unseen = unseenCards(state, player);
  const draws = Math.ceil(state.pile.length / 2);
  const theirDraws = (state.seat?.handSizes?.[1 - player] ?? state.spec.handSize) + Math.floor(state.pile.length / 2);
  const known = knownCards(state, player);
  if (!known) return { unseen, draws, next: undefined, theirHand: [], theirDraws };
  const seen = [...known.mine, ...known.theirs];
  return { unseen: unseenWithout(unseen, seen), draws: draws - known.mine.length, next: known.mine, theirHand: known.theirs, theirDraws: theirDraws - known.theirs.length };
}

const withoutAll = (cards, taken) => taken.reduce(without, cards);

/**
 * `determinize` for a player who peeked: the top cards they saw stay on top in their order, the cards they know
 * the opponent holds stay in that hand, and only the rest is dealt at random.
 */
export function dealKnowing(copy, state, player, { rng, unseen }) {
  const { top, held } = state.known[player];
  const onTop = state.pile.slice(state.pile.length - top);
  const theirs = state.hands[1 - player];
  const kept = state.openHands ? theirs : held;
  const rest = rng.shuffle(withoutAll(unseen, [...onTop, ...kept]));
  const free = theirs.length - kept.length;
  copy.hands[1 - player] = [...kept, ...rest.slice(0, free)];
  copy.pile = [...rest.slice(free), ...onTop];
  return copy;
}
