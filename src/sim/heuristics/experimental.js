import { DISTILLED_CORE } from "./distilled-core.js";
import { DISTILLED_CORE as PAIR_CORE } from "./distilled-pair.js";
import { IDEA_WEIGHTS, STRATEGIST_IDEAS } from "./ideas.js";
import { SEARCH } from "../search/search.js";
import { HABITS, STRATEGY } from "./strategist.js";

/**
 * The sandbox bot. It starts as an exact copy of the strategist; an idea is
 * tried by changing it here (and bumping its version in `src/config/bots.js`),
 * then measured with `npm run duel -- experimental stratege`. What wins moves
 * into the strategist, with a new strategist version.
 *
 * `EXPERIMENT` is the 0.7's: the same strategist 1.2 core as Stratège 2.1,
 * with a deeper flat search (`search.js`): 8 candidates, successive halving,
 * stopped by a rollout budget (`budget`, or `experimental:N` as an engine id).
 * The line-up's Expérimental is an ISMCTS tree since the 0.8 (`ismcts.js`,
 * `BOT_LINEUP` in `src/config/bots.js`); its cores are the `CORES` below.
 * The ideas it tried before (`ideas.js`, `principles.js`) and what they
 * measured are in docs/strategie.md and docs/analyse-replays.md.
 */
export const EXPERIMENT = Object.freeze({
  habits: HABITS,
  strategy: Object.freeze({ ...STRATEGY }),
  // 0.6: its core also knows which borders are already decided (certainty.js).
  ideas: Object.freeze([...STRATEGIST_IDEAS, "certain"]),
  weights: Object.freeze({ ...IDEA_WEIGHTS }),
  // 0.7: an endgame of 8 cards or fewer, pile empty, is solved exactly (exact.js).
  search: Object.freeze({ ...SEARCH, budget: 400, exact: true }),
});

/**
 * Earlier and candidate versions of the experimental bot, as settings, for
 * duels. Each spells out every setting it differs by, so a later change to
 * EXPERIMENT cannot leak into it. Any of them, and `experimental`, takes
 * `@N` for a budget of N rollouts (`experimental:0.6@200`).
 */
const FROZEN = {
  // The 0.7, as the page played it until the 0.8 (an ISMCTS, src/sim/mcts/ismcts.js).
  "experimental:0.7": EXPERIMENT,
  "experimental:0.6": { ...EXPERIMENT, search: { ...EXPERIMENT.search, exact: false } },
};

/**
 * Changes an engine id may stack on a base with `+key=value`, to screen
 * candidates without freezing each one: `experimental+sample=0.05+prior=0.15`.
 */
const VARIANTS = {
  sample: (settings, value) => ({ ...settings, rolloutSample: Number(value) }),
  prior: (settings, value) => ({ ...settings, search: { ...settings.search, prior: Number(value) } }),
  candidates: (settings, value) => ({ ...settings, search: { ...settings.search, candidates: Number(value) } }),
};

function applyVariant(settings, change) {
  const [key, value] = change.split("=");
  if (!Object.hasOwn(VARIANTS, key)) throw new Error(`Variante inconnue : « ${key} »`);
  return VARIANTS[key](settings, value);
}

/** The settings an experimental engine id names — a base, then its `+` variants — or null. */
export function experimentalSettings(name) {
  const [base, ...changes] = name.split("+");
  let settings = null;
  if (Object.hasOwn(FROZEN, base)) settings = FROZEN[base];
  else if (base === "experimental") settings = EXPERIMENT;
  return settings && changes.reduce(applyVariant, settings);
}

/** An engine id's `@` suffix: `@800` for 800 rollouts (or iterations) a move, `@t1500` for 1.5 s a move, whatever that buys. */
export function budgetOf(at) {
  if (at === undefined) return {};
  return at.startsWith("t") ? { budget: Infinity, budgetMs: Number(at.slice(1)) } : { budget: Number(at) };
}

/**
 * Named cores for the tree (`ismcts+core=nb1`, `+shortlist=plain`, `+rollout=plain`)
 * and for core duels (`core:nb1`): the 0.9's core, with neighbours (`neighbors`,
 * ideas.js, λ 1 or 2), with `runs`, or plain — the border odds and the cards'
 * price only, no habit, idea nor certainty: does the bonus steer the search?
 */
export const CORES = Object.freeze({
  exp: EXPERIMENT,
  nb1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "neighbors"], weights: { ...EXPERIMENT.weights, neighbors: 1 } },
  nb2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "neighbors"], weights: { ...EXPERIMENT.weights, neighbors: 2 } },
  runs: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "runs"] },
  plain: { ...EXPERIMENT, habits: [], ideas: [] },
  // Sami's first-card ideas (outbid.js), at a few weights: `ob` outbid, `obw` only when outnumbered, `ex` exposure.
  ob1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid"], weights: { ...EXPERIMENT.weights, outbid: 0.1 } },
  ob2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid"], weights: { ...EXPERIMENT.weights, outbid: 0.2 } },
  ob4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid"], weights: { ...EXPERIMENT.weights, outbid: 0.4 } },
  obw2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid"], weights: { ...EXPERIMENT.weights, outbid: 0.2, outbidWide: 1 } },
  obw4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid"], weights: { ...EXPERIMENT.weights, outbid: 0.4, outbidWide: 1 } },
  ex1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "exposure"], weights: { ...EXPERIMENT.weights, exposure: 0.1 } },
  ex2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "exposure"], weights: { ...EXPERIMENT.weights, exposure: 0.2 } },
  ex4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "exposure"], weights: { ...EXPERIMENT.weights, exposure: 0.4 } },
  obex: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid", "exposure"], weights: { ...EXPERIMENT.weights, outbid: 0.2, exposure: 0.2 } },
  // Choosing a game, trips or runs (shapes.js): `pl` plan, `en` ends, `mr` midRuns, `wr` weakRuns; `sh` all four, `shx` with obex.
  pl1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "plan"], weights: { ...EXPERIMENT.weights, plan: 0.1 } },
  pl2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "plan"], weights: { ...EXPERIMENT.weights, plan: 0.2 } },
  pl4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "plan"], weights: { ...EXPERIMENT.weights, plan: 0.4 } },
  en1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "ends"], weights: { ...EXPERIMENT.weights, ends: 0.1 } },
  en2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "ends"], weights: { ...EXPERIMENT.weights, ends: 0.2 } },
  en4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "ends"], weights: { ...EXPERIMENT.weights, ends: 0.4 } },
  mr1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "midRuns"], weights: { ...EXPERIMENT.weights, midRuns: 0.1 } },
  mr2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "midRuns"], weights: { ...EXPERIMENT.weights, midRuns: 0.2 } },
  wr1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "weakRuns"], weights: { ...EXPERIMENT.weights, weakRuns: 0.1 } },
  wr2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "weakRuns"], weights: { ...EXPERIMENT.weights, weakRuns: 0.2 } },
  enj2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "ends"], weights: { ...EXPERIMENT.weights, ends: 0.2, endsReal: 0 } },
  enj4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "ends"], weights: { ...EXPERIMENT.weights, ends: 0.4, endsReal: 0 } },
  // Rules mined from the kept games (mined.js, npm run rules): `jk` junk, `fc` facing, `ub` underbid, `nw` nextToWon.
  jk1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: 0.1 } },
  jk2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: 0.2 } },
  fc1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "facing"], weights: { ...EXPERIMENT.weights, facing: 0.1 } },
  fc2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "facing"], weights: { ...EXPERIMENT.weights, facing: 0.2 } },
  ub1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "underbid"], weights: { ...EXPERIMENT.weights, underbid: 0.1 } },
  ub2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "underbid"], weights: { ...EXPERIMENT.weights, underbid: 0.2 } },
  nw1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "nextToWon"], weights: { ...EXPERIMENT.weights, nextToWon: 0.1 } },
  nw2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "nextToWon"], weights: { ...EXPERIMENT.weights, nextToWon: 0.2 } },
  jk3: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: 0.3 } },
  jk4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: 0.4 } },
  jk6: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: 0.6 } },
  jkx: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk", "outbid", "exposure"], weights: { ...EXPERIMENT.weights, junk: 0.2, outbid: 0.2, exposure: 0.2 } },
  // Where to put a joker (joker-ideas.js, npm run jokers): `jf` jokerFull, `jw` jokerWait, `jm` jokerMid, `jr` jokerRuns.
  jf1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerFull"], weights: { ...EXPERIMENT.weights, jokerFull: 0.1 } },
  jf2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerFull"], weights: { ...EXPERIMENT.weights, jokerFull: 0.2 } },
  jf4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerFull"], weights: { ...EXPERIMENT.weights, jokerFull: 0.4 } },
  jw1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerWait"], weights: { ...EXPERIMENT.weights, jokerWait: 0.1 } },
  jw2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerWait"], weights: { ...EXPERIMENT.weights, jokerWait: 0.2 } },
  jw4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerWait"], weights: { ...EXPERIMENT.weights, jokerWait: 0.4 } },
  jm1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerMid"], weights: { ...EXPERIMENT.weights, jokerMid: 0.1 } },
  jm2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerMid"], weights: { ...EXPERIMENT.weights, jokerMid: 0.2 } },
  jm4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerMid"], weights: { ...EXPERIMENT.weights, jokerMid: 0.4 } },
  jr: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerRuns"], weights: { ...EXPERIMENT.weights } },
  jkxr: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk", "outbid", "exposure", "jokerRuns"], weights: { ...EXPERIMENT.weights, junk: 0.2, outbid: 0.2, exposure: 0.2 } },
  dp1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "deepen"], weights: { ...EXPERIMENT.weights, deepen: 0.1 } },
  dp2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "deepen"], weights: { ...EXPERIMENT.weights, deepen: 0.2 } },
  dp4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "deepen"], weights: { ...EXPERIMENT.weights, deepen: 0.4 } },
  jt1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerTrap"], weights: { ...EXPERIMENT.weights, jokerTrap: 0.1 } },
  jt2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerTrap"], weights: { ...EXPERIMENT.weights, jokerTrap: 0.2 } },
  jt4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerTrap"], weights: { ...EXPERIMENT.weights, jokerTrap: 0.4 } },
  jt8: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "jokerTrap"], weights: { ...EXPERIMENT.weights, jokerTrap: 0.8 } },
  // Sami's bait (bait.js): low starts on borders that matter to neither side.
  bt1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "bait"], weights: { ...EXPERIMENT.weights, bait: 0.1 } },
  bt2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "bait"], weights: { ...EXPERIMENT.weights, bait: 0.2 } },
  bt4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "bait"], weights: { ...EXPERIMENT.weights, bait: 0.4 } },
  // Pushing the core the way the oracle played (oracle-ideas.js, data/oracle-diffs.json).
  stay1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.1 } },
  stay2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.2 } },
  stay4: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4 } },
  stay8: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.8 } },
  jkxs: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk", "outbid", "exposure", "stay"], weights: { ...EXPERIMENT.weights, junk: 0.2, outbid: 0.2, exposure: 0.2, stay: 0.4 } },
  // stay narrowed (oracle-ideas.js): the weight around 0.4, which card, a figure kept, when, behind on borders.
  st3: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.3 } },
  st5: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.5 } },
  st2nd: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4, stayCard: 2 } },
  st3rd: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4, stayCard: 3 } },
  stfig: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4, stayFigure: 1 } },
  stearly: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4, stayUntil: 20 } },
  stlate: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4, stayFrom: 20 } },
  stbehind: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.4, stayBehind: 1 } },
  stfig6: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 } },
  // The suit budget on the 1.2's core (Sami, 14/10, suit-budget.js): per card of shortfall on a suit, 0.05 to 1.
  stfig6sb6: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "suitBudget"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, suitBudget: 0.6 } },
  stfig6sb10: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "suitBudget"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, suitBudget: 1 } },
  stfig6sb05: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "suitBudget"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, suitBudget: 0.05 } },
  stfig6sb1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "suitBudget"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, suitBudget: 0.1 } },
  stfig6sb3: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "suitBudget"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, suitBudget: 0.3 } },
  jkxf: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk", "outbid", "exposure", "stay"], weights: { ...EXPERIMENT.weights, junk: 0.2, outbid: 0.2, exposure: 0.2, stay: 0.4, stayFigure: 1 } },
  stfig8: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.8, stayFigure: 1 } },
  stfig10: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 1, stayFigure: 1 } },
  stfig12: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 1.2, stayFigure: 1 } },
  stfig15: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 1.5, stayFigure: 1 } },
  jkxf6: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk", "outbid", "exposure", "stay"], weights: { ...EXPERIMENT.weights, junk: 0.2, outbid: 0.2, exposure: 0.2, stay: 0.6, stayFigure: 1 } },
  // Ideas on for turns 1-10 only (Sami, 03/10: the tree is weakest early, a bonus may hurt later): earlyIdeas, earlyUntil.
  jk2e10: { ...EXPERIMENT, earlyIdeas: ["junk"], earlyUntil: 10, weights: { ...EXPERIMENT.weights, junk: 0.2 } },
  obexe10: { ...EXPERIMENT, earlyIdeas: ["outbid", "exposure"], earlyUntil: 10, weights: { ...EXPERIMENT.weights, outbid: 0.2, exposure: 0.2 } },
  jkxe10: { ...EXPERIMENT, earlyIdeas: ["junk", "outbid", "exposure"], earlyUntil: 10, weights: { ...EXPERIMENT.weights, junk: 0.2, outbid: 0.2, exposure: 0.2 } },
  wholee10: { ...EXPERIMENT, earlyIdeas: ["whole"], earlyUntil: 10, weights: { ...EXPERIMENT.weights } },
  stay4e10: { ...EXPERIMENT, earlyIdeas: ["stay"], earlyUntil: 10, weights: { ...EXPERIMENT.weights, stay: 0.4 } },
  stfig6e10: { ...EXPERIMENT, earlyIdeas: ["stay"], earlyUntil: 10, weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 } },
  // The 0.9's own bonuses kept to turns 1-10 (Sami, 03/10): one at a time, moved to earlyIdeas or earlyHabits.
  nomid10: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "middle"), earlyIdeas: ["middle"], earlyUntil: 10 },
  nospread10: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "spread"), earlyIdeas: ["spread"], earlyUntil: 10 },
  noconn10: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "connector"), earlyIdeas: ["connector"], earlyUntil: 10 },
  nojoker10: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), earlyHabits: ["joker"], earlyUntil: 10 },
  noopen10: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "opening"), earlyHabits: ["opening"], earlyUntil: 10 },
  nosuited10: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "suited"), earlyHabits: ["suited"], earlyUntil: 10 },
  // The 0.9's own bonuses from turn 15 on only (`<x>15`), and taken out altogether (`no<x>`): Sami, 03/10.
  mid15: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "middle"), lateIdeas: ["middle"], lateFrom: 15 },
  nomid: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "middle") },
  spread15: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "spread"), lateIdeas: ["spread"], lateFrom: 15 },
  nospread: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "spread") },
  conn15: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "connector"), lateIdeas: ["connector"], lateFrom: 15 },
  conn11: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "connector"), lateIdeas: ["connector"], lateFrom: 11 },
  conn19: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "connector"), lateIdeas: ["connector"], lateFrom: 19 },
  noconn: { ...EXPERIMENT, ideas: EXPERIMENT.ideas.filter((idea) => idea !== "connector") },
  joker15: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), lateHabits: ["joker"], lateFrom: 15 },
  nojoker: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker") },
  open15: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "opening"), lateHabits: ["opening"], lateFrom: 15 },
  noopen: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "opening") },
  suited15: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "suited"), lateHabits: ["suited"], lateFrom: 15 },
  nosuited: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "suited") },
  // Only the suited habit kept (03/10): the one bonus whose loss shows (41.1 % without it before turn 15).
  lean: { ...EXPERIMENT, habits: ["suited"], ideas: ["certain"] },
  nobonus: { ...EXPERIMENT, habits: [], ideas: ["certain"] },
  // On the 1.0 (04/10): in 242 whole games the oracle answers the opponent's borders more (33 % of its early moves against 23 %) and opens
  // untouched ones less (44 % against 60 %). `noAnswer` below 0 is a bonus for answering; `noBlindOpen` costs a blind opening;
  // `junk` below 0 accepts sides with no figure (37 % of its gaps against 2 %, turns 12-28).
  ...Object.fromEntries([["v1ans1", "noAnswer", -0.1], ["v1ans2", "noAnswer", -0.2], ["v1blind1", "noBlindOpen", 0.1], ["v1blind2", "noBlindOpen", 0.2], ["v1jneg1", "junk", -0.1], ["v1jneg2", "junk", -0.2]].map(([name, idea, weight]) => [name, { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", idea], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, [idea]: weight } }])),
  // In its gaps against the 1.0 core (turns 12-28), the oracle plays a joker 14 % of the time against 2 %: the 1.0 without the joker habit.
  // The start of a game only (turns 1-12, earlyIdeas), on the 1.0 (Sami, 04/10): open fewer untouched borders (noOpen),
  // accept sides with no figure (junk below 0), build fewer suited runs (noRun) — the oracle's three early traits.
  ...Object.fromEntries([["e12open1", "noOpen", 0.1], ["e12open2", "noOpen", 0.2], ["e12junk1", "junk", -0.1], ["e12junk2", "junk", -0.2], ["e12run1", "noRun", 0.1], ["e12run2", "noRun", 0.2]].map(([name, idea, weight]) => [name, { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], earlyIdeas: [idea], earlyUntil: 12, weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, [idea]: weight } }])),
  // The two that held in core against core (04/10), together.
  v1bj: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "noBlindOpen", "junk"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, noBlindOpen: 0.1, junk: -0.2 } },
  v1freejk: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 } },
  // The 1.0's core with B1 (lite): a one-card side is worth its card alone, for core duels (`core:v1lite`).
  v1lite: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 }, lite: true },
  // B3: the 1.0 with its pair discount tuned on the oracle (npm run distill -- --keys pairDiscount --name pair); nothing else moves.
  distpair: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 }, params: PAIR_CORE.params },
  // The 1.2 core under test (Sami, 07/10, the endgame traps): the 1.1's core, the joker priced by its best use elsewhere once the pile is empty (end-joker.js).
  stfig6ej: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 }, endJoker: true },
  // ForkThreat (Sami, 11/10, fork.js): the 1.2's core, plus a bonus on the borders that win the game or would leave a double threat, for either side.
  ...Object.fromEntries([1, 2, 4, 10].map((tenths) => [`stfig6fork${tenths}`, { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "fork"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1, fork: tenths / 10 } }])),
  // The 1.2 tactical urgency core (Sami, 08/10, from the endgame traps): empty pile, priority to completing 2-card borders, urgency checks, no cardCost penalty (end-urgency.js).
  stfig6crit: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 }, endUrgency: true },
  // JokerWin (Sami, 19/10, joker-win.js): the 1.2's core, a joker only where it wins the game — root, tree and rollouts.
  stfig6jw: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay", "jokerWin"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 } },
  v1nc: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas.filter((idea) => idea !== "connector"), "stay"], weights: { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 } },
  // The 1.0's core with every weight tuned at once on the oracle's moves (npm run distill, distill.js; Sami, 04/10).
  dist1: {
    ...EXPERIMENT,
    ideas: [...EXPERIMENT.ideas, "stay", ...DISTILLED_CORE.ideas],
    strategy: { ...EXPERIMENT.strategy, ...DISTILLED_CORE.strategy },
    weights: { ...EXPERIMENT.weights, stayFigure: 1, ...DISTILLED_CORE.weights },
    params: DISTILLED_CORE.params,
  },
  noans1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "noAnswer"], weights: { ...EXPERIMENT.weights, noAnswer: 0.1 } },
  noans2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "noAnswer"], weights: { ...EXPERIMENT.weights, noAnswer: 0.2 } },
  blind1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "noBlindOpen"], weights: { ...EXPERIMENT.weights, noBlindOpen: 0.1 } },
  blind2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "noBlindOpen"], weights: { ...EXPERIMENT.weights, noBlindOpen: 0.2 } },
  jneg1: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: -0.1 } },
  jneg2: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "junk"], weights: { ...EXPERIMENT.weights, junk: -0.2 } },
  freejk: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), ideas: [...EXPERIMENT.ideas], weights: { ...EXPERIMENT.weights } },
  orc1: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), ideas: [...EXPERIMENT.ideas, "stay", "noAnswer", "noBlindOpen", "junk"], weights: { ...EXPERIMENT.weights, stay: 0.1, noAnswer: 0.1, noBlindOpen: 0.1, junk: -0.1 } },
  orc2: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), ideas: [...EXPERIMENT.ideas, "stay", "noAnswer", "noBlindOpen", "junk"], weights: { ...EXPERIMENT.weights, stay: 0.2, noAnswer: 0.2, noBlindOpen: 0.2, junk: -0.1 } },
  orc1p: { ...EXPERIMENT, habits: HABITS.filter((habit) => habit !== "joker"), ideas: [...EXPERIMENT.ideas, "stay", "noAnswer", "noBlindOpen"], weights: { ...EXPERIMENT.weights, stay: 0.1, noAnswer: 0.1, noBlindOpen: 0.1 } },
  sh: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "plan", "ends", "midRuns", "weakRuns"], weights: { ...EXPERIMENT.weights } },
  shx: { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "outbid", "exposure", "plan", "ends", "midRuns", "weakRuns"], weights: { ...EXPERIMENT.weights, outbid: 0.2, exposure: 0.2 } },
});

export function coreOf(name) {
  if (!Object.hasOwn(CORES, name)) throw new Error(`Cœur inconnu : « ${name} » (connus : ${Object.keys(CORES).join(", ")})`);
  return CORES[name];
}

/**
 * `{ "core:<name>": engine }` for every named core, built by `make(settings)` — as
 * it plays the rollouts, without `certain`: proving certainties on every move
 * makes a core game many times slower, and the rollouts never ran them.
 */
export const coreEngines = (make) =>
  Object.fromEntries(Object.entries(CORES).map(([name, settings]) => [`core:${name}`, make({ ...settings, ideas: settings.ideas.filter((idea) => idea !== "certain"), name: `core:${name}` })]));
