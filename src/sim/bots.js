import { isJoker, valueOf } from "../core/cards.js";
import { withEndgame } from "./end-urgency.js";
import { handOf, withFigureMoves } from "./figure-gains.js";import { withCertainties } from "./certainty.js";
import { EXPERIMENT, budgetOf, coreEngines, coreOf, experimentalSettings } from "./experimental.js";
import { ismctsBot, ismctsSettings } from "./ismcts.js";
import { PAIR_DISCOUNT, createPairMemo, createValuer, sidePotential } from "./potential.js";
import { IDEAS, IDEA_WEIGHTS, STRATEGIST_IDEAS, borderFactors } from "./ideas.js";
import { lookaheadBot } from "./lookahead.js";
import { coreCounts } from "./peek.js";
import { phaseBot, phaseSettings } from "./phase.js";
import { pickBest, pickSampled } from "./pick.js";
import { searchBot } from "./search.js";
import { HABITS, STRATEGY, strategistMoves } from "./strategist.js";
import { jokerGate } from "./joker-gate.js";
import { gameOdds, settledOdds } from "./truncate.js";
import { tuningsOf } from "./tuning.js";

/**
 * Players for the simulation and the web game.
 *
 * `random` plays any legal card anywhere: it shows what the deck gives when
 * nobody chooses. `greedy` plays the card that most raises its chance of
 * winning one border, measured against what the opponent's side is likely
 * to become. `strategist` is `greedy` plus Sami's habits (`strategist.js`);
 * `experimental` is the strategist with its own settings (`experimental.js`).
 * None looks ahead.
 *
 * Every bot is `{ name, scoreMoves(state, moves, options), choose(state, moves) }`.
 * `scoreMoves` returns each candidate with its gain: the replay logs and the
 * observer's "why this move" panel read it. `options.keepAll` keeps the moves
 * a bot refuses to consider (marked `refused`), to advise on a human's move.
 */
const TEMPERATURE = 0.35;
const JOKER_COST = 0.08;
const CARD_COST = 0.02;
/** Slope of the win chance at even odds: value units → win-chance units. */
const VALUE_TO_CHANCE = 1 / (4 * TEMPERATURE);
/** The estimate's settings; a bot may carry its own (`params`), to be tuned. */
export const BOT_PARAMS = Object.freeze({ temperature: TEMPERATURE, jokerCost: JOKER_COST, cardCost: CARD_COST, pairDiscount: PAIR_DISCOUNT });
export { pickBest, pickSampled };

export const randomBot = (rng) => ({
  name: "random",
  scoreMoves: (_state, moves) => moves.map((move) => ({ move, gain: 0 })),
  choose: (_state, moves) => moves[rng.int(moves.length)],
});

export const greedyBot = (rng) => ({
  name: "greedy",
  scoreMoves: scoreGreedy,
  choose: (state, moves) => pickBest(scoreGreedy(state, moves), rng),
});

/**
 * `greedy` plus some of Sami's habits (all three by default), and optionally
 * some of his later ideas (`ideas.js`, none by default).
 */
const STRATEGIST_DEFAULTS = Object.freeze({ habits: HABITS, strategy: STRATEGY, ideas: [], earlyIdeas: [], earlyHabits: [], lateIdeas: [], lateHabits: [], earlyUntil: 0, lateFrom: Infinity, weights: IDEA_WEIGHTS, params: BOT_PARAMS });

export const strategistBot = (rng, options = {}) => {
  const settings = { ...STRATEGIST_DEFAULTS, ...options };
  const { habits, name, sample } = settings;
  const tuningAt = tuningsOf(settings);
  const scoreMoves = (state, moves, { keepAll = false } = {}) => scoreStrategist(state, moves, tuningAt(state.turn), keepAll);
  return {
    name: name ?? (habits.length === HABITS.length ? "strategist" : `strategist:${habits.join("+")}`),
    scoreMoves,
    // `sample` (a temperature): draw the move instead of taking the best — for rollouts only.
    choose: (state, moves) => (sample ? pickSampled(scoreMoves(state, moves), rng, sample) : pickBest(scoreMoves(state, moves), rng)),
  };
};

function views(state, lite = false, params = undefined) {
  const player = state.current;
  // The counts (peek.js): the unseen cards and the draws to come — less what a seat compensation let the player see.
  const [valuer, { unseen, draws, next, theirHand, theirDraws }] = [createValuer(state), coreCounts(state, player)];
  // Each view gets its own memo: the same pair is judged many times in one scoring. Written out field by field:
  // built on every scoring of every rollout, a spread costs more than it reads. `next`: the cards it will draw.
  const mine = { valuer, unseen, hand: null, draws, jokerAllowed: jokerGate(state, player), memo: createPairMemo(), withoutCard: new Map(), params, alone: undefined, lite, next };
  // The opponent's hand is unknown: treat it as more draws from the unseen.
  const theirs = {
    valuer,
    unseen,
    hand: theirHand,
    draws: theirDraws,
    jokerAllowed: jokerGate(state, 1 - player),
    memo: createPairMemo(), lite, params,
  };
  const threat = state.borders.map((border) => sidePotential(border.sides[1 - player], theirs));
  return { mine, threat };
}

function scoreGreedy(state, moves) {
  const { mine, threat } = views(state);
  return withFigureMoves(state, moves, () => borderChances(state, state.current, { mine, threat }), (cards) => cards.map((move) => ({ move, gain: moveGain(state, move, mine, threat[move.border]) })));
}

/** One move's score taken apart (the retrospective page, `scripts/retrospective.js`): potentials, odds before and after, the card's price. */
export function explainMove(state, move) {
  const { mine, threat } = views(state);
  const view = withoutCard(state, mine, move.card);
  const side = state.borders[move.border].sides[state.current];
  const [now, next, theirs] = [sidePotential(side, view), sidePotential([...side, move.card], view), threat[move.border]];
  return { mine: now, mineAfter: next, theirs, before: winChance(now, theirs), after: winChance(next, theirs), cost: cardCost(state.spec, move.card) };
}

/** The bot's own odds of winning each border, as things stand. */
function borderChances(state, player, { mine, threat }) {
  const withHand = { ...mine, hand: mine.next ? [...handOf(state, player), ...mine.next] : handOf(state, player) };
  return state.borders.map((border, index) => winChance(sidePotential(border.sides[player], withHand), threat[index], mine.params));
}

/** Every card on the board, border by border, side by side — without `flat()`, which a rollout paid for on every move. */
function boardCards(state) {
  const cards = [];
  for (const border of state.borders) for (const side of border.sides) for (const card of side) cards.push(card);
  return cards;
}

/** A border already won counts 1, lost 0, whatever its sides would say. */
const ownedOdds = (state, player, chances) => state.borders.map((border, i) => (border.owner === null ? chances[i] : Number(border.owner === player)));

/** The player to move's odds of winning the game, from the core's odds on each border: what a cut rollout stops on (truncate.js). */
export function winOdds(state) {
  const { mine, threat } = views(state);
  const chances = borderChances(state, state.current, { mine, threat });
  return gameOdds(state.borders.map((border, i) => settledOdds(state, state.current, border, chances[i])));
}

/** What the ideas read on top of the strategist's context; nothing when none is on. */
function ideasContext(state, player, { ideas, gates, weights }, seen) {
  if (ideas.size === 0) return {};
  return {
    ideas,
    gates,
    weights,
    hand: handOf(state, player),
    theirSides: state.borders.map((border) => border.sides[1 - player]),
    boardCards: boardCards(state),
    pile: state.pile.length,
    theirHand: state.hands[1 - player].length,
    owners: state.borders.map((border) => border.owner),
    turn: state.turn,
    me: player,
    chances: ["runs", "dump", "neighbors", "bait"].some((idea) => ideas.has(idea)) ? ownedOdds(state, player, borderChances(state, player, seen)) : null,  };
}

/** Whether the `certain` idea is on: borders already lost are enumerated (`certainty.js`). */
function certaintyOf(ideas) {
  return ideas?.has("certain") ? {} : null;
}

function scoreStrategist(state, moves, { habits, strategy, params, ...tuning }, keepAll = false) {
  const { threat, mine } = views(state, tuning.lite, params);
  const seen = { mine, threat };
  const player = state.current;
  const context = {
    spec: state.spec,
    evaluator: state.evaluator,
    unseen: mine.unseen,
    mySides: state.borders.map((border) => border.sides[player]),
    habits,
    strategy,
    memo: new Map(),
    ...ideasContext(state, player, tuning, seen),
  };
  const factors = (context.gates?.factors ?? Boolean(context.ideas)) ? borderFactors(context, state.borders.length, context.chances) : null;
  const plainGain = context.ideas?.has("whole") ? wholeGains(state, seen) : (move) => moveGain(state, move, mine, threat[move.border]);
  const certainty = certaintyOf(context.ideas);
  const costOf = (card) => cardCost(state.spec, card, params);
  // `endJoker` (core 1.2) and `endUrgency` (stfig6crit), end-urgency.js: once the pile is empty.
  const gainOf = withEndgame(state, moves, certainty ? withCertainties(state, plainGain, costOf) : plainGain, { costOf, tuning });
  const options = { gainOf: (move) => gainOf(move) * (factors?.[move.border] ?? 1), scale: 1 / (4 * params.temperature), keepAll };
  const scoreCards = (cards) => strategistMoves(cards, (move) => state.borders[move.border].sides[player], context, options);
  return withFigureMoves(state, moves, () => borderChances(state, state.current, seen), scoreCards);
}

/**
 * `whole` (ideas.js): a move judged on the whole board. A card leaving the
 * hand also takes away what it promised the other borders — the 9♠ that would
 * have joined the 8♠ — which `moveGain` never counts. Gain = Σ over my borders
 * of the win chance after, minus before, minus the card's cost.
 */
function wholeGains(state, { mine, threat }) {
  const player = state.current;
  const sides = state.borders.map((border) => border.sides[player]);
  const hand = handOf(state, player);
  const worth = (side, context, index) => winChance(sidePotential(side, context), threat[index], mine.params);
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  const before = sum(sides.map((side, index) => worth(side, { ...mine, hand }, index)));
  const perCard = new Map();
  for (const card of new Set(hand)) {
    const rest = [...hand];
    rest.splice(rest.indexOf(card), 1);
    const context = { ...mine, hand: rest };
    const each = sides.map((side, index) => worth(side, context, index));
    perCard.set(card, { context, each, total: sum(each) });
  }
  return ({ card, border }) => {
    const { context, each, total } = perCard.get(card);
    const after = total - each[border] + worth([...sides[border], card], context, border);
    return after - before - cardCost(state.spec, card, mine.params);
  };
}

const winChance = (mine, theirs, params = BOT_PARAMS) => 1 / (1 + Math.exp((theirs - mine) / params.temperature));

/** The view without `card` in hand, built once per card and scoring (`context.withoutCard`, keyed by the card). */
function withoutCard(state, context, card) {
  const cached = context.withoutCard?.get(card);
  if (cached) return cached;
  const hand = [...handOf(state, state.current)];
  hand.splice(hand.indexOf(card), 1);
  // The cards it will draw (a peek, `views`) weigh as cards of the hand; they cannot be played yet.
  if (context.next) hand.push(...context.next);
  // The same fields as the view it comes from (`views`), the hand aside: written out, not spread.
  const { valuer, unseen, draws, jokerAllowed, memo, params, lite } = context;
  const view = { valuer, unseen, hand, draws, jokerAllowed, memo, withoutCard: context.withoutCard, params, alone: undefined, lite };
  context.withoutCard?.set(card, view);
  return view;
}

/**
 * The card alone on an empty side, with the rest of the hand: the same for
 * every empty border, so worked out once per card and scoring (`alone` on
 * the card's view) — early in a game most borders are empty.
 */
function aloneOf(view, card) {
  if (view.alone === undefined) view.alone = sidePotential([card], view);
  return view.alone;
}

function moveGain(state, { card, border }, context, threat) {
  const withHand = withoutCard(state, context, card);
  const side = state.borders[border].sides[state.current];
  const params = context.params ?? BOT_PARAMS;
  const before = winChance(sidePotential(side, withHand), threat, params);
  const after = winChance(side.length === 0 ? aloneOf(withHand, card) : sidePotential([...side, card], withHand), threat, params);
  return after - before - cardCost(state.spec, card, params);
}

/** Spending a joker or a high card has a price: keep them for later. */
export function cardCost(spec, card, params = BOT_PARAMS) {
  if (isJoker(card)) return params.jokerCost;
  return (params.cardCost * valueOf(spec, card)) / spec.values;
}

export { VALUE_TO_CHANCE };

/**
 * A strategist that looks ahead (`lookahead.js`): `settings` configure both the
 * strategist that shortlists the moves and the one that plays the rollouts.
 */
const lookaheadOf = (settings, name) => (rng) => {
  const base = strategistBot(rng, settings);
  const policy = (seeded) => strategistBot(seeded, settings);
  return lookaheadBot(rng, { base, policy, ...settings.lookahead, name });
};

/**
 * The bot that plays the experimental search's rollouts: `settings`'
 * strategist without `certain` — certainties choose the real move; in the
 * rollouts they cost a third of the speed for nothing measurable (0.7) —
 * `keepCertain` (`+simCertain=1`, 12/10) keeps them, to measure it again.
 * `npm run policy` measures it on its own.
 */
export const rolloutPolicyOf = (settings) => {
  const rollouts = { ...settings, ideas: (settings.ideas ?? []).filter((idea) => settings.keepCertain || idea !== "certain"), sample: settings.rolloutSample };
  return (seeded) => strategistBot(seeded, rollouts);
};

export const searchOf = (settings, overrides = {}) => (rng) => {
  const base = strategistBot(rng, settings);
  return searchBot(rng, { base, policy: rolloutPolicyOf(settings), ...settings.search, name: "experimental", ...overrides });
};

/** Bot engines by id. The public line-up (names, versions) is `src/config/bots.js`. */
export const BOTS = Object.freeze({
  random: randomBot,
  greedy: greedyBot,
  strategist: (rng) => strategistBot(rng, { ideas: STRATEGIST_IDEAS, name: "strategist" }),
  // Strategist 1.1 plus look-ahead: the line-up's Stratège 2. Too slow for the report's simulations.
  lookahead: lookaheadOf({ ideas: STRATEGIST_IDEAS }, "lookahead"),
  experimental: searchOf(EXPERIMENT),
  // One habit at a time, to weigh each against the plain greedy bot.
  "strategist:joker": (rng) => strategistBot(rng, { habits: ["joker"] }),
  "strategist:opening": (rng) => strategistBot(rng, { habits: ["opening"] }),
  "strategist:suited": (rng) => strategistBot(rng, { habits: ["suited"] }),
  // Earlier generations, for the report: the three habits alone (1.0), plus the first two ideas (1.1).
  "strategist:habits": (rng) => strategistBot(rng, { name: "strategist:habits" }),
  "strategist:1.1": (rng) => strategistBot(rng, { ideas: ["middle", "spread"], name: "strategist:1.1" }),
  // The three habits plus one idea at a time, to weigh each idea on its own.
  ...Object.fromEntries(IDEAS.map((idea) => [`idea:${idea}`, (rng) => strategistBot(rng, { ideas: [idea], name: `idea:${idea}` })])),
  // The named cores (experimental.js), alone: `core:nb1` against `core:exp`, in seconds.
  ...coreEngines((settings) => (rng) => strategistBot(rng, settings)),
});

/** The ISMCTS bot on the experimental core; `sample` makes its rollouts draw their moves. */
// `lite` (B1): the rollouts' core judges a one-card side by its card alone; at 1 the tree's nodes keep the whole core, at 2 only the root does.
// `simCertain` (12/10): the simulations keep `certain`, the tree's nodes judge without it.
const ismctsOf = ({ sample, core = "exp", shortlist = core, rollout = core, lite = 0, simCertain = 0, ...tree }, budget) => (rng) =>
  ismctsBot(rng, { base: strategistBot(rng, coreOf(shortlist)), policy: rolloutPolicyOf({ ...coreOf(rollout), rolloutSample: sample, lite: lite > 0, keepCertain: simCertain > 0 }), treePolicy: lite === 1 || simCertain > 0 ? rolloutPolicyOf({ ...coreOf(rollout), rolloutSample: sample }) : undefined, oddsOf: winOdds, ...tree, ...budget });

/**
 * An engine by id: one of `BOTS`, or `experimental:N` — the experimental bot
 * with a budget of N rollouts a move, to weigh depth against time in duels —
 * or `phase:<switch>:<early>/<late>`, two engines in turn (phase.js).
 */
export function engineFor(id) {
  const phases = phaseSettings(id);
  if (phases) return phaseBot({ ...phases, early: engineFor(phases.early), late: engineFor(phases.late) });
  const [name, at] = id.split("@");
  const budget = budgetOf(at);
  const settings = experimentalSettings(name);
  if (settings) return searchOf(settings, budget);
  const tree = ismctsSettings(name);
  if (tree) return ismctsOf(tree, budget);
  if (Object.hasOwn(BOTS, id)) return BOTS[id];
  const rollouts = /^experimental:(\d+)$/.exec(id)?.[1];
  if (rollouts) return searchOf(EXPERIMENT, { budget: Number(rollouts) });
  throw new Error(`Moteur inconnu : « ${id} »`);
}
