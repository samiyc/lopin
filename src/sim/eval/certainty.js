import { isJoker } from "../../core/cards.js";
import { withoutFigures } from "../../core/figures.js";
import { evaluatorFor } from "../engine/border-rules.js";
import { unseenCards } from "./potential.js";

/**
 * What is already certain about a border, seen from one player — the claim
 * of the original Schotten Totten, proved by enumeration rather than guessed.
 *
 * - `won`: my side is complete and no finish of the other side can beat it
 *   (a tie goes to whoever completed first: me, since they have not).
 * - `lost`: their side is complete and no finish of mine can beat it, with
 *   any cards I may still get — my hand and every card I cannot see.
 * - `open`: neither.
 *
 * These are theorems, not estimates: a `won` border is won whatever happens,
 * and the tests hold them to that over whole random games.
 */
export const STATUS = Object.freeze({ won: "won", lost: "lost", open: "open" });

/**
 * Every set of `need` cards from `pool` (sorted), each distinct set once —
 * the two jokers are one card twice — with at most `jokers` jokers.
 */
function combinations(pool, need, jokers, from = 0) {
  if (need === 0) return [[]];
  const sets = [];
  for (let i = from; i < pool.length; i += 1) {
    const repeated = i > from && pool[i] === pool[i - 1];
    const joker = isJoker(pool[i]);
    if (repeated || (joker && jokers === 0)) continue;
    const rests = combinations(pool, need - 1, jokers - Number(joker), i + 1);
    sets.push(...rests.map((rest) => [pool[i], ...rest]));
  }
  return sets;
}

/** The best score `side` can finish with, adding cards from `pool` (jokers at most `jokers`). */
function bestFinish(evaluator, side, pool, jokers) {
  if (side.length === 3) return evaluator.score(side);
  return Math.max(-Infinity, ...combinations(pool, 3 - side.length, jokers).map((set) => evaluator.score([...side, ...set])));
}

/** How many more jokers `player` may still put on `side`. */
function jokerRoom(state, player, side) {
  const { maxPerSide, maxPerPlayer } = state.jokerRule;
  return Math.max(0, Math.min(maxPerSide - side.filter(isJoker).length, maxPerPlayer - state.jokersPlayed[player]));
}

const sorted = (cards) => [...cards].sort((a, b) => a - b);
const unseenList = (state, player) => sorted(unseenCards(state, player).entries.flatMap(([card, count]) => Array(count).fill(card)));

/** My side is complete: won if no finish of theirs beats it (ties go to whoever completed first). Each side under its border's rules. */
function statusOfMyFullSide(state, index, player, pool = unseenList(state, player)) {
  const border = state.borders[index];
  const [mine, theirs] = [border.sides[player], border.sides[1 - player]];
  const score = evaluatorFor(state, index, player).score(mine);
  const theirBest = bestFinish(evaluatorFor(state, index, 1 - player), theirs, pool, jokerRoom(state, 1 - player, theirs));
  const iWinTies = theirs.length < 3 || border.completedAt[player] < border.completedAt[1 - player];
  if (score > theirBest || (score === theirBest && iWinTies)) return STATUS.won;
  return theirs.length === 3 ? STATUS.lost : STATUS.open;
}

/** Only their side is complete: lost if no finish of mine beats it (a tie goes to them). */
function statusAgainstTheirFullSide(state, index, player) {
  const border = state.borders[index];
  const [mine, theirs] = [border.sides[player], border.sides[1 - player]];
  const pool = sorted([...withoutFigures(state.hands[player]), ...unseenList(state, player)]);
  const myBest = bestFinish(evaluatorFor(state, index, player), mine, pool, jokerRoom(state, player, mine));
  return myBest <= evaluatorFor(state, index, 1 - player).score(theirs) ? STATUS.lost : STATUS.open;
}

/** The status of border `index` for `player` (`STATUS`). */
export function borderStatus(state, index, player) {
  const border = state.borders[index];
  if (border.owner !== null && border.owner !== undefined) return border.owner === player ? STATUS.won : STATUS.lost;
  if (border.sides[player].length === 3) return statusOfMyFullSide(state, index, player);
  if (border.sides[1 - player].length === 3) return statusAgainstTheirFullSide(state, index, player);
  return STATUS.open;
}

/**
 * Whether `player` may claim border `index` under the printed rule: their
 * side is complete, and no finish of the other side can beat it with any card
 * not on the table — their own hand included, since the proof may only rest
 * on what both players see. Stricter than `borderStatus`, which also knows
 * the player's hand.
 */
export function isClaimable(state, index, player) {
  const border = state.borders[index];
  if (border.owner !== null || border.sides[player].length < 3) return false;
  const offTable = sorted([...withoutFigures(state.hands[player]), ...unseenList(state, player)]);
  return statusOfMyFullSide(state, index, player, offTable) === STATUS.won;
}

/** Every border's status for `player`. */
export const boardStatus = (state, player) => state.borders.map((_, index) => borderStatus(state, index, player));

/** What a card thrown on a lost border costs beyond its own price: a move that changes nothing. */
const WASTE = 0.02;

/**
 * `gainOf` with every move onto a border already lost for the mover rated by
 * the card thrown away (`costOf(card)`) instead: whatever lands there changes
 * nothing, so the cheapest card is the one to spend. The `certain` idea.
 */
export function withCertainties(state, gainOf, costOf) {
  const statuses = boardStatus(state, state.current);
  if (!statuses.includes(STATUS.lost)) return gainOf;
  return (move) => (statuses[move.border] === STATUS.lost ? -WASTE - costOf(move.card) : gainOf(move));
}
