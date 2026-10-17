import { shapeOf } from "../../sim/eval/shapes.js";
import { jokersOf } from "../core/jokers-held.js";
import { replayStates, rulesOf } from "../core/log.js";
import { loggedMove, traitsOf } from "./move-features.js";

/**
 * Two engines compared on the games they played against each other (`npm run
 * versus`, 03/10): not only who won, but how — what each one plays, phase by
 * phase, and what its side of the board looks like at the end. Made to explain
 * a version's gain before it ships (why stfig wins) and to read the
 * attempts that did not.
 *
 * `readGame` reads one logged game from A's side; `summarize` pools them. The
 * pairs are the decks played from both seats: a pair's score carries none of
 * the deck's luck, which is what the paired interval rests on.
 */
export const PHASES = Object.freeze([
  ["début (1-12)", 1, 12],
  ["milieu (13-24)", 13, 24],
  ["fin (25+)", 25, Infinity],
]);
const OPENED_BY = 10;

const phaseOf = (turn) => PHASES.find(([, from, to]) => turn >= from && turn <= to)[0];

/** The seat `engine` sat in (its engine id or its tag), or -1. */
export const seatOf = (log, engine) => log.players.findIndex((player) => player.bot === engine || player.version === engine);

/** A's points in a game: 1, ½ for a draw, 0. */
const pointsOf = (winner, seat) => (winner === null || winner === undefined ? 0.5 : Number(winner === seat));

/** Each side's moves, phase by phase: how many, and how many carried each trait. */
function movesBySide(log, frames) {
  const { spec } = rulesOf(log.rules);
  const sides = [{}, {}];
  frames.slice(1).forEach(({ entry }, i) => {
    if (!entry || entry.pass || !entry.move) return;
    const { move, hand } = loggedMove(spec, entry);
    const phase = (sides[entry.player][phaseOf(entry.turn)] ??= { moves: 0, traits: {} });
    phase.moves += 1;
    for (const trait of traitsOf({ ...frames[i].state, spec }, entry.player, hand, move)) phase.traits[trait] = (phase.traits[trait] ?? 0) + 1;
  });
  return sides;
}

/** A side of the board at the end: borders it had opened by turn 10, complete sides, those with no figure, borders won. */
function endOf(spec, frames, seat) {
  const early = frames[Math.min(OPENED_BY, frames.length - 1)].state;
  const last = frames.at(-1).state;
  const mine = last.borders.map((border) => border.sides[seat]);
  const complete = mine.filter((side) => side.length === 3);
  return {
    openedBy10: early.borders.filter((border) => border.sides[seat].length > 0).length,
    complete: complete.length,
    noFigure: complete.filter((side) => shapeOf(spec, side) === null).length,
    won: last.borders.filter((border) => border.owner === seat).length,
  };
}

/** One game from A's side, or null when A did not play it. */
export function readGame(log, engine) {
  const seat = seatOf(log, engine);
  if (seat < 0) return null;
  const { spec } = rulesOf(log.rules);
  const frames = replayStates(log);
  const jokers = jokersOf(log).total;
  const moves = movesBySide(log, frames);
  return {
    deck: log.deck.join(" "),
    seat,
    points: pointsOf(log.result.winner, seat),
    turns: log.turns.length,
    jokers: `${jokers[seat]} contre ${jokers[1 - seat]}`,
    sides: [seat, 1 - seat].map((player) => ({ moves: moves[player], end: endOf(spec, frames, player) })),
  };
}

const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

/** A's score on each deck played from both seats. */
export function pairScores(games) {
  const byDeck = new Map();
  for (const game of games) byDeck.set(game.deck, [...(byDeck.get(game.deck) ?? []), game.points]);
  return [...byDeck.values()].filter((points) => points.length === 2).map(mean);
}

/** A's mean score in each group `keyOf` sorts the games into. */
function scoreBy(games, keyOf) {
  const groups = new Map();
  for (const game of games) groups.set(keyOf(game), [...(groups.get(keyOf(game)) ?? []), game.points]);
  return Object.fromEntries([...groups].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, points]) => [key, { games: points.length, score: mean(points) }]));
}

/** Each trait's share of a side's moves in a phase, for A and B side by side, widest gap first. */
function traitShares(games, phase) {
  const totals = [0, 1].map((side) => {
    const sum = { moves: 0, traits: {} };
    for (const game of games) {
      const own = game.sides[side].moves[phase];
      if (!own) continue;
      sum.moves += own.moves;
      for (const [trait, count] of Object.entries(own.traits)) sum.traits[trait] = (sum.traits[trait] ?? 0) + count;
    }
    return sum;
  });
  const names = new Set([...Object.keys(totals[0].traits), ...Object.keys(totals[1].traits)]);
  const shareOf = (side, name) => (totals[side].traits[name] ?? 0) / Math.max(1, totals[side].moves);
  return [...names].map((trait) => ({ trait, a: shareOf(0, trait), b: shareOf(1, trait) })).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
}

/** The end of the board, side by side: each measure's mean for A and for B. */
function endShares(games) {
  const keys = Object.keys(games[0]?.sides[0].end ?? {});
  return Object.fromEntries(keys.map((key) => [key, { a: mean(games.map((game) => game.sides[0].end[key])), b: mean(games.map((game) => game.sides[1].end[key])) }]));
}

/** Every game of A against B pooled: the score and its pairs, by seat and by jokers, the play and the end compared. */
export function summarize(games) {
  return {
    games: games.length,
    score: mean(games.map((game) => game.points)),
    pairs: pairScores(games),
    bySeat: scoreBy(games, (game) => (game.seat === 0 ? "A commence" : "B commence")),
    byJokers: scoreBy(games, (game) => game.jokers),
    turns: mean(games.map((game) => game.turns)),
    traits: Object.fromEntries(PHASES.map(([phase]) => [phase, traitShares(games, phase)])),
    end: endShares(games),
  };
}
