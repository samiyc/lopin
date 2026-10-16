import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { OFFICIAL_RULES } from "../src/config/rules.js";
import { DUEL_ROW, SEED } from "../src/config/simulations.js";
import { BALANCED, judgeDeals, nearestMedian } from "./lib/deal-judge.js";
import { applyThreadsOption, runPool } from "./lib/pool.js";
import { tmpFile } from "./lib/tmp.js";

/**
 * `npm run deals -- [--deals N] [--plays K | --root I] [--engine E] [--offset K] [--pool file]`:
 * Omniscient 1.0 (`+omniscient=1`: both hands and the pile's order seen) judges
 * N deals at the page's claim rule, two ways:
 * - `--plays K` (the default, 10): against itself, K whole games a deal, the
 *   bots seeded otherwise every time; a deal's share is the games its first
 *   player won. K games' cost a deal.
 * - `--root I`: one long search on turn 1, I iterations, two seeds; a deal's
 *   share is the root's estimate for the first player (the most visited
 *   move's win rate). A few moves' cost a deal, but only as right as the
 *   rollouts that make it.
 * Prints the first player's share (the seat advantage left between
 * omniscients: the rules' part), the deals one side wins whoever plays (luck),
 * and the balanced ones (40-60 %). Deal d is the deck `createRng(seed d)`
 * shuffles, the same in both modes; `--pool file` writes the balanced deals'
 * seeds, which `npm run duel -- a b --pool file` plays (another `--offset`
 * makes a reserve). Every share goes to tmp/deals-<offset>.json.
 *
 * Default engine: the 1.2's tree, omniscient, at 400 iterations (the daytime
 * budget); a judgment worth keeping runs at night with `--engine`.
 */
const args = process.argv.slice(2);
applyThreadsOption(args);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const DEALS = Number(valueOf("--deals", 100));
const PLAYS = Number(valueOf("--plays", 10));
const ROOT = Number(valueOf("--root", 0));
const ENGINE = valueOf("--engine", "ismcts+widen=7+depth=5+core=stfig6+exact=12+omniscient=1@400");
const OFFSET = Number(valueOf("--offset", 0));
const POOL = valueOf("--pool", null);
// `--size N`: the pool keeps the N deals nearest the median share, the most disputed whatever the root's bias.
const SIZE = Number(valueOf("--size", 0));
const DEALS_SEED = SEED + 7_000_001 * (OFFSET + 1);
const seedOf = (deal) => DEALS_SEED + 7919 * deal;
// Five deals a task: a game of omniscients at 400 takes half a minute a thread, so smaller tasks keep 18 threads busy.
const CHUNK = 5;
const endMode = OFFICIAL_RULES.endMode;

/** `--plays K`: every play of a chunk deals the same decks (`deals`); only the bots' seed changes. */
function playTasks() {
  const tasks = [];
  for (let from = 0; from < DEALS; from += CHUNK) {
    for (let play = 0; play < PLAYS; play += 1) {
      tasks.push({ ...DUEL_ROW, endMode, keepWinners: true, players: [ENGINE, ENGINE], games: Math.min(CHUNK, DEALS - from), seed: DEALS_SEED + 104729 * (tasks.length + 1), deals: seedOf(from), from });
    }
  }
  return tasks;
}

/** `--root I`: a chunk's deals searched on turn 1, two seeds each. */
function rootTasks() {
  const engine = ENGINE.replace(/@\d+$/, `@${ROOT}`);
  const tasks = [];
  for (let from = 0; from < DEALS; from += CHUNK) {
    const dealSeeds = Array.from({ length: Math.min(CHUNK, DEALS - from) }, (_, g) => seedOf(from + g));
    tasks.push({ row: DUEL_ROW, endMode, engine, dealSeeds, seeds: [DEALS_SEED + 1, DEALS_SEED + 2], from });
  }
  return tasks;
}

const started = Date.now();
let done = 0;
const tasks = ROOT ? rootTasks() : playTasks();
const worker = ROOT ? "./lib/deal-root-worker.js" : "./lib/sim-worker.js";
const results = await runPool(new URL(worker, import.meta.url), tasks, {
  onResult: () => {
    done += 1;
    if (done % Math.max(1, Math.round(tasks.length / 10)) === 0) process.stderr.write(`  ${done} / ${tasks.length} lots, ${Math.round((Date.now() - started) / 1000)} s\n`);
  },
});

const firsts = Array.from({ length: DEALS }, () => 0);
const points = (winner) => (winner === null ? 0.5 : Number(winner === 0));
if (ROOT) results.forEach((result, i) => result.values.forEach((value, g) => (firsts[tasks[i].from + g] = value)));
else results.forEach((result, i) => result.winners.forEach((winner, g) => (firsts[tasks[i].from + g] += points(winner))));
const judged = judgeDeals(firsts, ROOT ? 1 : PLAYS);
const pct = (share) => `${(100 * share).toFixed(1).replace(".", ",")} %`;
const how = ROOT ? `racine du tour 1 à ${ROOT} itérations, 2 graines` : `${PLAYS} parties par donne`;

console.log(`# Omniscient contre Omniscient — ${DEALS} donnes, ${how}, ${ENGINE.replace(/@\d+$/, "")}, offset ${OFFSET}\n`);
const spread = ROOT ? " (estimé par la racine, qui le surestime)" : ` (${pct(judged.firstInterval[0])} – ${pct(judged.firstInterval[1])}) sur ${DEALS * PLAYS} parties`;
console.log(`- Premier joueur : ${pct(judged.first)}${spread}`);
console.log(`- Donnes décidées (un camp à au moins 90 %) : ${pct(judged.decided)}`);
console.log(`- Donnes équilibrées (40 à 60 % pour le premier joueur) : ${pct(judged.balanced)}`);
console.log(`- Par dixième de la part du premier joueur : ${judged.tenths.join(" · ")}`);
console.log(`\nDurée : ${Math.round((Date.now() - started) / 1000)} s`);
const out = tmpFile(`deals-${OFFSET}.json`);
const seeds = judged.shares.map((_, d) => seedOf(d));
await writeFile(out, `${JSON.stringify({ engine: ENGINE, root: ROOT || null, plays: ROOT ? null : PLAYS, offset: OFFSET, ...judged, seeds }, null, 1)}\n`);
console.log(`→ ${decodeURIComponent(out.pathname)}`);
if (POOL) {
  const { picked, band } = SIZE ? nearestMedian(judged.shares, SIZE) : { picked: judged.shares.map((_, d) => d).filter((d) => judged.shares[d] >= BALANCED[0] && judged.shares[d] <= BALANCED[1]), band: BALANCED };
  const pool = { engine: ENGINE, how, offset: OFFSET, deals: DEALS, band: band.map((x) => Number(x.toFixed(4))), seeds: picked.map((d) => seeds[d]), shares: picked.map((d) => Number(judged.shares[d].toFixed(4))) };
  await mkdir(dirname(POOL), { recursive: true });
  await writeFile(POOL, `${JSON.stringify(pool)}\n`);
  console.log(`→ ${POOL} : ${picked.length} donnes, ${pct(band[0])} à ${pct(band[1])} pour le premier joueur (npm run duel -- a b --pool ${POOL})`);
}
