import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { exposurePenalty, outbidBonus } from "./outbid.js";
import { baitBonus } from "./bait.js";
import { forkBonus } from "../eval/fork.js";
import { JOKER_IDEAS, jokerTrapBonus } from "./joker-ideas.js";
import { MINED_IDEAS, anyMined, minedBonus } from "./mined.js";
import { ORACLE_IDEAS, anyOracleIdea, oracleBonus } from "./oracle-ideas.js";
import { SHAPE_IDEAS, anyShapeIdea, shapesBonus } from "../eval/shapes.js";
import { suitBudgetBonus } from "./suit-budget.js";
import { PRINCIPLES, PRINCIPLE_WEIGHTS, activePrinciples, principlesBonus } from "./principles.js";

/**
 * Sami's strategy ideas from his games against the web bots
 * (`docs/Prompt/web ui fix prompt.md`), as switchable adjustments on top of
 * the strategist. Bonuses are in value units, like `STRATEGY`.
 *
 * - `counter`: answer the opponent's line on a border with the same shape one
 *   notch higher (5-6-7 against 4-5-6, 5-5-5 against 4-4-4); opening a border
 *   the opponent has not touched offers them that same answer, so it costs
 *   a little (`exposed`).
 * - `middle`: the three middle borders — the ones every run of three adjacent
 *   borders goes through — only open on a solid start: three of a kind held,
 *   or two suited cards in a row with both ends still unseen on the board.
 * - `edges`: a start that is not solid goes to the borders at the edges.
 * - `spread`: never open a value that already sits alone on another border:
 *   two lone 7s want the same cards, and one of them will miss its trips.
 */
export const IDEAS = Object.freeze(["counter", "middle", "edges", "spread", "weight", "runs", "dump", "whole", "certain", "neighbors", "outbid", "exposure", "fork", "suitBudget",...SHAPE_IDEAS, ...MINED_IDEAS, ...JOKER_IDEAS, "bait", ...ORACLE_IDEAS, ...PRINCIPLES]);

/**
 * What the strategist plays. 1.1: measured against 1.0 over 24 000 games
 * (docs/analyse-replays.md), `spread` alone wins 54.5 %, with `middle` 55.6 %;
 * `counter` and `edges` changed nothing measurable. 1.2 adds `connector`
 * (principles.js): 53.9 % against 1.1 (docs/strategie.md).
 */
/**
 * Which families of ideas a set turns on, worked out once per bot rather than
 * on every move of every rollout (`context.gates`; a context without it falls
 * back to asking the set).
 */
export const gatesOf = (ideas) => ({
  mined: anyMined(ideas),
  shapes: anyShapeIdea(ideas),
  oracle: anyOracleIdea(ideas),
  principles: activePrinciples(ideas),
  // Families an idea set leaves off are not even called (npm run features, 05/10: 7 % of the core's
  // time went to bonus functions that only found out they were off): the sums stay the same.
  jokerTrap: ideas.has("jokerTrap"),
  bait: ideas.has("bait"),
  fork: ideas.has("fork"),
  // `borderFactors` only when an idea scales the borders: otherwise every factor is 1.
  factors: ideas.has("neighbors") || ideas.has("weight") || ideas.has("runs"),
});

export const STRATEGIST_IDEAS = Object.freeze(["middle", "spread", "connector"]);

/**
 * `spread` is worth a veto: at 0.15 it won 55.2 %, at 0.6 56.9 %, and no
 * higher weight did better.
 */
export const IDEA_WEIGHTS = Object.freeze({
  neighbors: 1,
  // outbid.js; `outbidWide` 1 keeps `outbid` to a board where the opponent has started more borders.
  outbid: 0.2,
  outbidWide: 0,
  exposure: 0.2,
  // shapes.js
  plan: 0.15,
  ends: 0.15,
  midRuns: 0.15,
  weakRuns: 0.15,
  // mined.js
  junk: 0.1,
  facing: 0.1,
  underbid: 0.1,
  nextToWon: 0.1,
  deepen: 0.1,
  // joker-ideas.js
  jokerFull: 0.1,
  jokerWait: 0.1,
  jokerMid: 0.1,
  jokerTrap: 0.1,
  bait: 0.1,
  // oracle-ideas.js
  stay: 0.1,
  noAnswer: 0.1,
  noBlindOpen: 0.1,
  noOpen: 0.1,
  noRun: 0.1,
  counter: 0.15,
  exposed: 0.05,
  middleSolid: 0.15,
  middleWeak: 0.15,
  edges: 0.1,
  spread: 0.6,
  // suit-budget.js (Sami, 14/10): per card of shortfall on a suit.
  suitBudget: 0.1,
  weight: 0.15,
  runs: 0.5,
  dump: 0.1,
  dumpBelow: 0.2,
  ...PRINCIPLE_WEIGHTS,
});

/** Sorted gaps between values, and whether the cards share a suit. */
function shapeOf(spec, cards) {
  const values = cards.map((card) => valueOf(spec, card)).sort((a, b) => a - b);
  return {
    gaps: values.slice(1).map((value, i) => value - values[i]).join(","),
    suited: new Set(cards.map((card) => colorOf(spec, card))).size === 1,
    top: values.at(-1),
  };
}

/** Two or more real cards, facing at least as many real cards. */
const comparable = (next, theirs) => next.length >= 2 && next.length <= theirs.length && ![...next, ...theirs].some(isJoker);

function counterBonus({ spec, weights }, mine, theirs, card) {
  if (theirs.length === 0) return mine.length === 0 ? -weights.exposed : 0;
  const next = [...mine, card];
  if (!comparable(next, theirs)) return 0;
  const ours = shapeOf(spec, next);
  const answered = shapeOf(spec, theirs.slice(0, next.length));
  return ours.gaps === answered.gaps && ours.suited === answered.suited && ours.top > answered.top ? weights.counter : 0;
}

const onBoard = (spec, boardCards, color, value) => boardCards.some((card) => !isJoker(card) && colorOf(spec, card) === color && valueOf(spec, card) === value);

/** A suited neighbour of `card` in hand whose two outer ends are both still unseen. */
function openConnector({ spec, hand, boardCards }, card) {
  const color = colorOf(spec, card);
  const value = valueOf(spec, card);
  return hand.some((other) => {
    if (other === card || isJoker(other) || colorOf(spec, other) !== color || Math.abs(valueOf(spec, other) - value) !== 1) return false;
    const [low, high] = [Math.min(value, valueOf(spec, other)) - 1, Math.max(value, valueOf(spec, other)) + 1];
    return low >= 1 && high <= spec.values && !onBoard(spec, boardCards, color, low) && !onBoard(spec, boardCards, color, high);
  });
}

/** Three of a kind already in hand (a joker counts), or an open suited connector. */
export function solidStart(context, card) {
  if (isJoker(card)) return false;
  const { spec, hand } = context;
  const twins = hand.filter((other) => other !== card && (isJoker(other) || valueOf(spec, other) === valueOf(spec, card)));
  return twins.length >= 2 || openConnector(context, card);
}

/** The three borders around the centre. */
const isMiddle = (border, count) => Math.abs(border - (count - 1) / 2) <= 1;

function placeBonus(context, border, card) {
  const { ideas, weights, mySides } = context;
  const solid = solidStart(context, card);
  const middle = isMiddle(border, mySides.length);
  let bonus = 0;
  if (ideas.has("middle") && middle) bonus += solid ? weights.middleSolid : -weights.middleWeak;
  if (ideas.has("edges") && !middle && !solid) bonus += weights.edges;
  return bonus;
}

function spreadPenalty({ spec, mySides, weights }, card) {
  if (isJoker(card)) return 0;
  const lone = mySides.some((side) => side.length === 1 && !isJoker(side[0]) && valueOf(spec, side[0]) === valueOf(spec, card));
  return lone ? -weights.spread : 0;
}

/**
 * The ideas' bonus for placing `card` on `border`. `context` is the
 * strategist's, plus `{ ideas: Set, hand, theirSides, boardCards, weights,
 * chances }` — `chances` only when an idea reads it.
 */
export function ideasBonus(context, border, card) {
  const { ideas } = context;
  const gates = context.gates ?? gatesOf(ideas);
  const mine = context.mySides[border];
  let bonus = 0;
  if (ideas.has("counter")) bonus += counterBonus(context, mine, context.theirSides[border], card);
  if (ideas.has("dump")) bonus += dumpBonus(context, border, card);
  if (gates.principles.length > 0) bonus += principlesBonus(context, border, card);
  if (ideas.has("suitBudget")) bonus += suitBudgetBonus(context, border, card);
  bonus += familiesBonus(context, gates, border, card);
  if (mine.length > 0) return gates.shapes ? bonus + shapesBonus(context, mine, card) : bonus;
  return bonus + firstCardBonus(context, border, card);
}

/** The mined, joker-trap, bait, fork and oracle families, each called only when on — a skipped one adds the 0 it would have returned. */
function familiesBonus(context, gates, border, card) {
  const mined = gates.mined ? minedBonus(context, border, card) : 0;
  const trap = gates.jokerTrap ? jokerTrapBonus(context, context.mySides[border], card) : 0;
  const bait = gates.bait ? baitBonus(context, border, card) : 0;
  const fork = gates.fork ? forkBonus(context, border) : 0;
  return mined + trap + bait + fork + (gates.oracle ? oracleBonus(context, border, card) : 0);
}

/** The ideas that only judge the first card on my side of a border. */
function firstCardBonus(context, border, card) {
  const { ideas } = context;
  let bonus = 0;
  if (ideas.has("middle") || ideas.has("edges")) bonus += placeBonus(context, border, card);
  if (ideas.has("spread")) bonus += spreadPenalty(context, card);
  if (ideas.has("outbid")) bonus += outbidBonus(context, border, card);
  if (ideas.has("exposure")) bonus += exposurePenalty(context, border, card);
  return bonus;
}

/**
 * Round two, after the games against strategist 1.1 (docs/analyse-replays.md):
 *
 * - `weight`: a border counts in 1, 2 or 3 runs of three adjacent borders
 *   (1-2-3-3-3-2-1 on seven); its gain is scaled by `1 + weight × (runs − 2)`.
 * - `runs`: the same, but from the game in hand — a border is worth more when
 *   the other borders of its runs look winnable (`chances`, the bot's own win
 *   estimate per border), less when they look lost.
 * - `dump`: on a border that looks lost, low cards are the ones to spend.
 */
/** How many runs of three adjacent borders go through each border. */
export function runsThrough(count) {
  return Array.from({ length: count }, (_, border) => [border - 2, border - 1, border].filter((start) => start >= 0 && start + 2 < count).length);
}

/** For each border, the summed odds of winning the other two borders of each of its runs. */
function runStakes(chances) {
  const stakes = chances.map(() => 0);
  for (let start = 0; start + 2 < chances.length; start += 1) {
    const run = [start, start + 1, start + 2];
    for (const border of run) stakes[border] += run.filter((other) => other !== border).reduce((odds, other) => odds * chances[other], 1);
  }
  return stakes;
}

/** A multiplier on each border's gain; all 1 unless `weight` or `runs` is on. */
export function borderFactors({ ideas, weights }, count, chances) {
  const factors = Array.from({ length: count }, () => 1);
  // `neighbors` (Sami, after the retrospective): a border is worth 1 for the majority, plus what it adds to
  // each run of three through it — the product of the other two borders' odds. The centre (three runs) and a
  // border that would complete a run well under way weigh more than an edge or a lone border.
  if (ideas.has("neighbors") && chances) runStakes(chances).forEach((stake, border) => (factors[border] *= 1 + weights.neighbors * stake));
  if (ideas.has("weight")) runsThrough(count).forEach((runs, border) => (factors[border] *= 1 + weights.weight * (runs - 2)));
  if (ideas.has("runs") && chances) {
    const stakes = runStakes(chances);
    const mean = stakes.reduce((a, b) => a + b, 0) / count;
    stakes.forEach((stake, border) => (factors[border] *= 1 + weights.runs * (stake - mean)));
  }
  return factors.map((factor) => Math.max(0.1, factor));
}

/** Low cards go to a border that looks lost. */
export function dumpBonus({ spec, weights, chances }, border, card) {
  if (isJoker(card) || !chances || chances[border] >= weights.dumpBelow) return 0;
  return weights.dump * (1 - valueOf(spec, card) / spec.values);
}
