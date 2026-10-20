import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { ideasBonus } from "./ideas.js";
import { jokerBonus, jokerCompletesRun } from "./joker-ideas.js";

/**
 * Sami's three habits from his real games, as adjustments on top of the
 * greedy bot's estimate. Bonuses are in value units (1 = one formation rank);
 * the two-player bot converts them to win-chance units itself.
 *
 * 1. The joker waits for a pair: it is only played to turn two cards of the
 *    same value into three of a kind, or when nothing else can be played.
 * 2. Columns open on middle cards (neither 1 nor the top value), one suit at
 *    a time, so straight flushes stay possible in every suit.
 * 3. Two suited cards that follow each other beat a pair, as long as a card
 *    that completes the straight flush is still unseen.
 */
export const STRATEGY = Object.freeze({ openMiddle: 0.1, openNewSuit: 0.1, suitedStart: 0.2 });

/** The three habits, switchable one by one so the report can weigh each. */
export const HABITS = Object.freeze(["joker", "opening", "suited"]);

const realCards = (side) => side.filter((card) => !isJoker(card));

/** A pair waiting for its third card: the only place a joker is worth it. */
export function jokerCompletesTrips(spec, side) {
  const real = realCards(side);
  return side.length === 2 && real.length === 2 && valueOf(spec, real[0]) === valueOf(spec, real[1]);
}

/** The suits the player has already opened a border with: once per scoring when the context has a memo. */
function openedSuits({ spec, mySides, memo }) {
  const cached = memo?.get("opened");
  if (cached) return cached;
  const opened = new Set(mySides.filter((side) => side.length > 0 && !isJoker(side[0])).map((side) => colorOf(spec, side[0])));
  memo?.set("opened", opened);
  return opened;
}

function openingBonus(context, card, strategy) {
  const { spec } = context;
  const value = valueOf(spec, card);
  const middle = value > 1 && value < spec.values ? strategy.openMiddle : 0;
  return middle + (openedSuits(context).has(colorOf(spec, card)) ? 0 : strategy.openNewSuit);
}

function suitedConnector(spec, a, b) {
  const gap = Math.abs(valueOf(spec, a) - valueOf(spec, b));
  return colorOf(spec, a) === colorOf(spec, b) && gap >= 1 && gap <= 2;
}

/** Is a card that turns `a`, `b` into a straight flush still among the unseen? */
function suitedOutLeft({ unseen, evaluator, memo }, a, b) {
  // A number, not a string: built on every suited start of every rollout. Negative, apart from the other keys.
  const key = -((a + 2) * 64 + b + 2);
  const cached = memo?.get(key);
  if (cached !== undefined) return cached;
  const left = unseen.entries.some(([card]) => !isJoker(card) && evaluator.formation([a, b, card]) === "straightFlush");
  memo?.set(key, left);
  return left;
}

function suitedBonus(context, side, card, strategy) {
  const [first] = side;
  if (side.length !== 1 || isJoker(first) || !suitedConnector(context.spec, first, card)) return 0;
  return suitedOutLeft(context, first, card) ? strategy.suitedStart : 0;
}

/**
 * `{ allowed, bonus }` for placing `card` on `side` (border `border`).
 * `context` carries `{ spec, evaluator, mySides, unseen, habits, strategy }`:
 * `habits` a subset of `HABITS`, `strategy` the bonuses (`STRATEGY` unless an
 * experiment says otherwise). With a non-empty `ideas` set it also carries
 * what `ideasBonus` (`ideas.js`) reads.
 */
/** The habits' bonus for a real card (jokers are only allowed or not). */
function habitsBonus(context, side, card) {
  const { habits } = context;
  const strategy = context.strategy ?? STRATEGY;
  let bonus = 0;
  if (habits.has("opening") && side.length === 0) bonus += openingBonus(context, card, strategy);
  if (habits.has("suited")) bonus += suitedBonus(context, side, card, strategy);
  return bonus;
}

/** Whether the strategist lays a joker on `side`: with `jokerWin` (joker-win.js) only to win the game (`jokerPair`: or on a pair), else on a pair (the habit). */
function jokerAllowed(side, context, border) {
  if (context.jokerWin) return context.jokerWin(border) || (context.ideas.has("jokerPair") && jokerCompletesTrips(context.spec, side));
  const runs = Boolean(context.ideas?.has("jokerRuns")) && jokerCompletesRun(context.spec, side);
  return !context.habits.has("joker") || jokerCompletesTrips(context.spec, side) || runs;
}

export function strategistAdjust(side, card, context, border) {
  if (isJoker(card)) return { allowed: jokerAllowed(side, context, border), bonus: jokerBonus(context, side, border) };
  let bonus = habitsBonus(context, side, card);
  if (context.ideas?.size > 0) bonus += ideasBonus(context, border, card);
  return { allowed: true, bonus };
}

/**
 * Scores moves with `gainOf(move)` plus the strategist's bonus (times
 * `scale`), after dropping the jokers it would not play — unless that leaves
 * nothing to play. With `keepAll` (advising on someone else's move), the
 * dropped moves stay in, scored and marked `refused`.
 */
export function strategistMoves(moves, sideOf, context, { gainOf, scale, keepAll = false }) {
  // Written out rather than spread: this runs on every move of every rollout.
  const judged = moves.map((move) => {
    const { allowed, bonus } = strategistAdjust(sideOf(move), move.card, context, move.border);
    return { move, allowed, bonus };
  });
  const allowed = judged.filter((entry) => entry.allowed);
  const pool = allowed.length > 0 ? allowed : judged;
  const kept = keepAll ? judged : pool;
  // Every kept move is in the pool unless `keepAll` brought refused ones back: only then is a lookup needed.
  const inPool = kept === pool ? null : new Set(pool);
  return kept.map((entry) => {
    const scored = { move: entry.move, gain: gainOf(entry.move) + scale * entry.bonus };
    return !inPool || inPool.has(entry) ? scored : { ...scored, refused: true };
  });
}
