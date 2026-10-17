import { BOT_PARAMS } from "../bots.js";
import { CORES } from "./experimental.js";

/**
 * The weights `npm run distill` moves (Sami, 04/10: a version at 55 % against
 * the V1). Instead of copying the oracle's traits one at a time into the core
 * (v1bj, e12open1: neutral), every weight of the 1.0's core (stfig6) moves at
 * once so that the oracle's move lands in the core's top 8 — the agreement
 * that ranked eight cores as their long duels did (0.93, data/oracle-bench.json).
 *
 * Each entry: where the weight lives in a core's settings (`strategy`,
 * `weights`, `params`), the size of one step, and for an idea the 1.0 does
 * not use, its name (it joins the core at 0, so step 0 is the 1.0 itself).
 */
export const BASE_CORE = "stfig6";
export const DISTILLED = Object.freeze([
  { key: "openMiddle", in: "strategy", step: 0.05 },
  { key: "openNewSuit", in: "strategy", step: 0.05 },
  { key: "suitedStart", in: "strategy", step: 0.05 },
  { key: "middleSolid", in: "weights", step: 0.05 },
  { key: "middleWeak", in: "weights", step: 0.05 },
  { key: "spread", in: "weights", step: 0.1 },
  { key: "connector", in: "weights", step: 0.1 },
  { key: "stay", in: "weights", step: 0.1 },
  { key: "junk", in: "weights", step: 0.05, idea: "junk" },
  { key: "noBlindOpen", in: "weights", step: 0.05, idea: "noBlindOpen" },
  { key: "temperature", in: "params", step: 0.03 },
  { key: "jokerCost", in: "params", step: 0.02 },
  { key: "cardCost", in: "params", step: 0.01 },
  // B3 (05/10): what a pair not yet placed is worth, against a placed one (potential.js).
  { key: "pairDiscount", in: "params", step: 0.03 },
]);
/** A weight never moves further than this many steps from the 1.0's. */
export const LIMIT = 8;

const base = CORES[BASE_CORE];
const sources = { strategy: base.strategy, weights: base.weights, params: BOT_PARAMS };

/** The 1.0's value of an entry; an idea it does not use starts at 0. */
export const startOf = (entry) => (entry.idea && !base.ideas.includes(entry.idea) ? 0 : sources[entry.in][entry.key]);

/** Steps away from the 1.0 (0 = the 1.0), as values grouped the way a core holds them, plus the ideas added. */
export function valuesAt(units) {
  const grouped = { strategy: {}, weights: {}, params: {}, ideas: [] };
  DISTILLED.forEach((entry, i) => {
    grouped[entry.in][entry.key] = Number((startOf(entry) + entry.step * units[i]).toFixed(4));
    if (entry.idea && !base.ideas.includes(entry.idea)) grouped.ideas.push(entry.idea);
  });
  return grouped;
}

/** The 1.0's core with `values` (from `valuesAt`, or a distilled file) laid over it. */
export const coreWith = (values) => ({
  ...base,
  ideas: [...base.ideas, ...values.ideas],
  strategy: { ...base.strategy, ...values.strategy },
  weights: { ...base.weights, ...values.weights },
  params: { ...BOT_PARAMS, ...values.params },
});

export const clampUnits = (units) => units.map((u) => Math.max(-LIMIT, Math.min(LIMIT, u)));

/** One game in four (by its key) is kept aside, to judge the result on positions the tuning never saw. */
export function heldOut(key) {
  let hash = 0x811c9dc5;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash % 4 === 0;
}

/** What the tuning maximises at one position: the oracle's move in the top 8, and a little more in first place. */
export const scoreOfRank = (rank) => (rank > 0 && rank <= 8 ? 1 : 0) + (rank === 1 ? 0.25 : 0);
