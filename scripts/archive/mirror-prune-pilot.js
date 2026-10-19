/**
 * MirrorPrune pilot (Sami, 19/10, `+mirror=2`): at the first move of `n` fresh deals, a tree searched with and without
 * the rule, from two seeds each. Does the favourite stand out of the pack — its interval clear of the best other
 * move's (twins are one move) — more often with the rule, and is it the same move from both seeds more often?
 * `node scripts/archive/mirror-prune-pilot.js [n] [budget] [--engine E] [--offset K]`, threads from `workerCount()`.
 */
import { runPool } from "../lib/cli/pool.js";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const [n = 100, budget = 10000] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--")).map(Number);
const BASE = option("--engine", "ismcts+widen=7+depth=10+core=stfig6+exact=12+pwl=3");
const ENGINES = [BASE, `${BASE}+mirror=2`];
const SEEDS = [7, 1007];
const FIRST_DEAL = 50000 + 1000 * Number(option("--offset", 0));

/** The favourite's lead over the best other move, in standard errors of the difference. */
function leadOf({ first, second }) {
  const se = (side) => Math.sqrt((side.rate * (1 - side.rate)) / Math.max(1, side.visits));
  return (first.rate - second.rate) / Math.hypot(se(first), se(second));
}

const clear = ({ first, second }) => first.interval[0] > second.interval[1];
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const pc = (count) => `${((100 * count) / n).toFixed(1)} %`;

function summary(results, e) {
  const runs = results.flatMap((deal) => deal[e]);
  const stable = results.filter((deal) => deal[e][0].first.key === deal[e][1].first.key).length;
  const clears = runs.filter(clear).length;
  const share = median(runs.map((run) => run.first.visits / run.total));
  return `${ENGINES[e]}@${budget}\n  coups distincts ${median(runs.map((run) => run.distinct))} · favori ${(100 * share).toFixed(1)} % des visites · avance sur le 2e ${median(runs.map(leadOf)).toFixed(2)} écart-type (médiane) · hors de la fourchette du 2e ${((100 * clears) / runs.length).toFixed(1)} % · même coup sur les deux graines ${pc(stable)}`;
}

const tasks = Array.from({ length: n }, (_, k) => ({ deal: FIRST_DEAL + k, engines: ENGINES, seeds: SEEDS, budget }));
const started = Date.now();
const results = await runPool(new URL("../lib/workers/mirror-pilot-worker.js", import.meta.url), tasks, {
  onProgress: (done) => done % 10 === 0 && console.log(`  ${done} / ${n} donnes, ${Math.round((Date.now() - started) / 1000)} s`),
});
console.log(`# MirrorPrune, premier coup de ${n} donnes (offset ${option("--offset", 0)}), deux graines par moteur\n`);
ENGINES.forEach((_, e) => console.log(summary(results, e)));
const changed = results.filter((deal) => deal[0][0].first.key !== deal[1][0].first.key).length;
console.log(`\nFavori changé par la règle (première graine) : ${pc(changed)}`);
