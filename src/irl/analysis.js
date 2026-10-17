import { ORDERS } from "../config/formations.js";
import { getEvaluator } from "../core/evaluator.js";
import { emptySoloTally, tallyLine } from "../sim/engine/solo.js";
import { loadEssais } from "./cards.js";

/**
 * Sami's real games, tallied exactly like the bots' solo games
 * (`tallyLine` in `src/sim/engine/solo.js`), so the two compare line for line. Every
 * real line also gets its exact optimum: there are only twenty.
 */
export function tallyEssais(essais = loadEssais()) {
  const { spec, jokerRule, games } = essais;
  const order = ORDERS.original;
  const evaluator = getEvaluator(spec, order, jokerRule);
  const tally = emptySoloTally();
  for (const game of games) {
    for (const name of ["haut", "bas"]) {
      tallyLine(tally, name, game.lines[name], { evaluator, spec, rules: { order, jokerRule }, optimum: true });
    }
    tally.games += 1;
  }
  return { deck: spec.id, jokerRule: jokerRule.id, order: "original", ...tally };
}

/** Wilson score interval at 95 %, for a share measured on few lines. */
export function wilson(successes, trials, z = 1.96) {
  if (trials === 0) return [0, 1];
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const spread = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  return [(centre - spread) / denominator, (centre + spread) / denominator];
}
