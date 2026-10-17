import { FORMATIONS } from "../../config/formations.js";
import { buildDeck, isJoker } from "../../core/cards.js";
import { getEvaluator } from "../../core/evaluator.js";
import { bestPartition, trioValue } from "../../core/partition.js";
import { createRng } from "../../core/random.js";
import { VALUE_TO_CHANCE, cardCost, pickBest } from "../bots.js";
import { addInto } from "./simulate.js";
import { createValuer, sidePotential } from "../eval/potential.js";
import { HABITS, strategistMoves } from "../heuristics/strategist.js";

/**
 * Sami's test protocol, played by a bot. The deck is cut in two halves of
 * 21; each half is played alone (hand of 6, then the pile) onto 7 columns of
 * 3, aiming for the best formation in every column. Nobody to beat.
 *
 * The top line is blind: what is still in the pile is unknown, so every card
 * not yet seen could come. The bottom line is informed: the other half lies
 * on the table, so the pile is known card for card, and every card in it
 * will come sooner or later.
 */
const HAND = 6;

function unseenOf(deck, seen) {
  const counts = new Map();
  for (const card of deck) counts.set(card, (counts.get(card) ?? 0) + 1);
  for (const card of seen) counts.set(card, counts.get(card) - 1);
  const entries = [...counts].filter(([, count]) => count > 0);
  return { entries, total: entries.reduce((sum, [, count]) => sum + count, 0) };
}

function knowledge(line, table) {
  const { hand, pile, columns, informed } = line;
  // Every card of a known pile will come: a huge but finite number of draws
  // (1 ** Infinity is NaN in JavaScript).
  if (informed) return { unseen: unseenOf(pile, []), draws: 1e9 };
  return { unseen: unseenOf(table.deck, [...hand, ...columns.flat()]), draws: pile.length };
}

function legalMoves(line, maxPerSide) {
  const moves = [];
  for (const card of new Set(line.hand)) {
    line.columns.forEach((column, index) => {
      const jokers = column.filter(isJoker).length;
      if (column.length < 3 && (!isJoker(card) || jokers < maxPerSide)) moves.push({ card, border: index });
    });
  }
  return moves;
}

function scoreMoves(line, table, moves) {
  const { unseen, draws } = knowledge(line, table);
  const maxPerSide = table.jokerRule.maxPerSide;
  const base = {
    valuer: table.valuer,
    unseen,
    draws,
    jokerAllowed: (side) => side.filter(isJoker).length < maxPerSide,
  };
  const gainOf = ({ card, border }) => {
    const hand = [...line.hand];
    hand.splice(hand.indexOf(card), 1);
    const context = { ...base, hand };
    const column = line.columns[border];
    const cost = cardCost(table.spec, card) / VALUE_TO_CHANCE;
    return sidePotential([...column, card], context) - sidePotential(column, context) - cost;
  };
  if (!table.habits) return moves.map((move) => ({ move, gain: gainOf(move) }));
  const context = { spec: table.spec, evaluator: table.evaluator, unseen, mySides: line.columns, habits: table.habits };
  return strategistMoves(moves, (move) => line.columns[move.border], context, { gainOf, scale: 1 });
}

function playLine(table, half, informed) {
  const pile = [...half];
  const line = { hand: pile.splice(0, HAND), pile, informed, columns: Array.from({ length: table.spec.borders }, () => []) };
  while (line.hand.length > 0) {
    const move = pickBest(scoreMoves(line, table, legalMoves(line, table.jokerRule.maxPerSide)), table.rng);
    line.hand.splice(line.hand.indexOf(move.card), 1);
    line.columns[move.border].push(move.card);
    if (line.pile.length > 0) line.hand.push(line.pile.shift());
  }
  return line.columns;
}

/** One solo game: `{ haut, bas }`, each 7 columns of 3 cards. */
export function playSolo(spec, { order, jokerRule, rng, habits = null }) {
  const evaluator = getEvaluator(spec, order, jokerRule);
  const deck = rng.shuffle(buildDeck(spec));
  const size = spec.borders * 3;
  const table = { spec, evaluator, jokerRule, rng, deck, valuer: createValuer({ spec, evaluator }), habits };
  return { haut: playLine(table, deck.slice(0, size), false), bas: playLine(table, deck.slice(size, 2 * size), true) };
}

const zeroCounts = () => Object.fromEntries(FORMATIONS.map((f) => [f, 0]));

export const emptySoloTally = () => ({
  games: 0,
  lines: { haut: zeroCounts(), bas: zeroCounts() },
  jokers: zeroCounts(),
  value: { haut: 0, bas: 0 },
  optimum: { lines: 0, value: 0, optimum: 0 },
});

/** Adds one line's columns to the tally; `optimum` also solves the line exactly. */
export function tallyLine(tally, name, columns, { evaluator, spec, rules, optimum }) {
  const value = trioValue(evaluator, spec);
  let total = 0;
  for (const column of columns) {
    const formation = evaluator.formation(column);
    tally.lines[name][formation] += 1;
    if (column.some(isJoker)) tally.jokers[formation] += 1;
    total += value(...column);
  }
  tally.value[name] += total;
  if (!optimum) return;
  tally.optimum.lines += 1;
  tally.optimum.value += total;
  tally.optimum.optimum += bestPartition(spec, columns.flat(), rules).total;
}

/**
 * Plays `games` solo games. The exact optimum costs a quarter of a second a
 * line, so only the first `optimumGames` games get it.
 */
export function playSoloBatch(spec, { order, jokerRule, games, seed, habits, optimumGames = 0 }) {
  const rng = createRng(seed);
  const evaluator = getEvaluator(spec, order, jokerRule);
  const tally = emptySoloTally();
  for (let g = 0; g < games; g += 1) {
    const { haut, bas } = playSolo(spec, { order, jokerRule, rng, habits: habits ? new Set(habits) : null });
    const options = { evaluator, spec, rules: { order, jokerRule }, optimum: g < optimumGames };
    tallyLine(tally, "haut", haut, options);
    tallyLine(tally, "bas", bas, options);
    tally.games += 1;
  }
  return tally;
}

export const mergeSoloTallies = (tallies) => tallies.reduce((acc, tally) => addInto(acc, tally), emptySoloTally());

export { HABITS };
