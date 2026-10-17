import { FORMATIONS } from "../../config/formations.js";
import { buildDeck } from "../../core/cards.js";
import { createRng } from "../../core/random.js";
import { engineFor } from "../bots.js";
import { playGame } from "./game.js";
import { dealFor } from "../eval/hand-classes.js";
import { parseSeat } from "./seat-rules.js";

const zeroCounts = () => Object.fromEntries(FORMATIONS.map((f) => [f, 0]));

function emptyTally() {
  return {
    games: 0,
    wins: [0, 0],
    draws: 0,
    turns: 0,
    endings: { adjacent: 0, majority: 0, exhaustion: 0, draw: 0 },
    built: zeroCounts(),
    builtTotal: 0,
    winning: zeroCounts(),
    decidedBy: { formation: 0, sum: 0, first: 0, claim: 0 },
    jokerEdge: { games: 0, won: 0 },
  };
}

/** Every finished side, both players, resolved border or not. */
function countBuilt(tally, state) {
  for (const border of state.borders) {
    for (const side of border.sides) {
      if (side.length < 3) continue;
      tally.built[state.evaluator.formation(side)] += 1;
      tally.builtTotal += 1;
    }
  }
}

function countResolved(tally, state) {
  for (const { winner, formations, decidedBy } of state.resolved) {
    tally.winning[formations[winner]] += 1;
    tally.decidedBy[decidedBy] += 1;
  }
}

/** Did the player who laid more jokers win? Only games where they differ. */
function countJokerEdge(tally, state) {
  const [zero, one] = state.jokersPlayed;
  if (zero === one || state.winner === null) return;
  tally.jokerEdge.games += 1;
  if (state.winner === (zero > one ? 0 : 1)) tally.jokerEdge.won += 1;
}

function record(tally, state) {
  tally.games += 1;
  tally.turns += state.turn;
  tally.endings[state.winType] += 1;
  if (state.winner === null) tally.draws += 1;
  else tally.wins[state.winner] += 1;
  countBuilt(tally, state);
  countResolved(tally, state);
  countJokerEdge(tally, state);
}

/** Game `g` of a batch: its deck from `deals`, dealt to give the first player a `handClass` hand when one is asked (`hand-classes.js`). */
function dealOf(spec, deals, handClass, g) {
  if (deals === null) return null;
  return handClass ? dealFor(spec, deals + 7919 * g, handClass) : createRng(deals + 7919 * g).shuffle(buildDeck(spec));
}

/**
 * `dealSeeds` (a pool of deals): game g dealt from its own seed (`npm run deals -- --pool`), as `dealOf` deals from
 * `deals` + 7919 g, or given as a deck, the cards in order (`npm run deal-pool`, from the kept duels).
 */
function pooledDeal(spec, dealSeeds, g) {
  if (!dealSeeds) return null;
  return Array.isArray(dealSeeds[g]) ? [...dealSeeds[g]] : createRng(dealSeeds[g]).shuffle(buildDeck(spec));
}

/** Game `g`'s deck: the batch's fixed one, else the pool's, else one dealt from `deals` (null: shuffled by the game). */
const deckOf = (spec, { deals = null, dealSeeds = null, handClass = null, deck = null }, g) => deck ?? pooledDeal(spec, dealSeeds, g) ?? dealOf(spec, deals, handClass, g);

/** Game `g` of a batch: its rules, and its deck when the batch fixes one. Shared with the recorded duels (`src/replay/core/bot-games.js`). */
export function gameRules(spec, options, g) {
  const { order, jokerRule, endMode = "early", openHands = false, seat = null } = options;
  // `seat`: a compensation for the first player, by id or name (seat-rules.js); none in the printed game.
  return { order, jokerRule, deck: deckOf(spec, options, g), endMode, openHands: Boolean(openHands), seat: parseSeat(seat) };
}

/**
 * Plays `games` matches between `players` (ids from `engineFor`) and returns
 * the raw tallies. Player 0 always starts. Tallies are plain sums, so chunks
 * played on several threads merge with `mergeTallies`.
 *
 * With `deals`, game g is dealt from its own seed (`deals` + g) whatever the
 * bots draw: a duel plays the same decks with the seats swapped, and the luck
 * of the cards cancels out, as in duplicate bridge. With `deck`, every game
 * is dealt that one deck: how good it is for each seat (`npm run luck`).
 */
export function playBatch(spec, options) {
  const { games, seed, players, keepWinners = false } = options;
  const rng = createRng(seed);
  const bots = players.map((id) => engineFor(id)(rng));
  const tally = emptyTally();
  // Duels pair each game with its mirror (same deck, seats swapped): they need every winner, in order.
  if (keepWinners) tally.winners = [];
  for (let g = 0; g < games; g += 1) {
    const state = playGame(spec, { ...gameRules(spec, options, g), rng, bots });
    record(tally, state);
    tally.winners?.push(state.winner);
  }
  return tally;
}

/** Tallies plus the shares the report reads. */
export function simulate(spec, options) {
  const tally = playBatch(spec, options);
  return { ...tally, shares: shares(tally) };
}

/** Adds every number of `source` into `target`, recursively; tallies are plain sums. */
export function addInto(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") target[key] += value;
    else addInto(target[key], value);
  }
  return target;
}

export function mergeTallies(tallies) {
  const merged = tallies.reduce((acc, tally) => addInto(acc, tally), emptyTally());
  return { ...merged, shares: shares(merged) };
}

export function shares(tally) {
  const of = (counts, total) =>
    Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, total ? v / total : 0]));
  const resolved = Object.values(tally.decidedBy).reduce((a, b) => a + b, 0);
  return {
    firstPlayerWins: tally.wins[0] / tally.games,
    secondPlayerWins: tally.wins[1] / tally.games,
    averageTurns: tally.turns / tally.games,
    endings: of(tally.endings, tally.games),
    built: of(tally.built, tally.builtTotal),
    winning: of(tally.winning, resolved),
    decidedBy: of(tally.decidedBy, resolved),
    jokerEdge: tally.jokerEdge.games ? tally.jokerEdge.won / tally.jokerEdge.games : null,
  };
}
