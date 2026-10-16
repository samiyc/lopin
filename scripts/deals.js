import { writeFile } from "node:fs/promises";
import { OFFICIAL_RULES } from "../src/config/rules.js";
import { DUEL_ROW, SEED } from "../src/config/simulations.js";
import { judgeDeals } from "./lib/deal-judge.js";
import { applyThreadsOption, runPool } from "./lib/pool.js";
import { tmpFile } from "./lib/tmp.js";

/**
 * `npm run deals -- [--deals N] [--plays K] [--engine E] [--offset K]`:
 * Omniscient 1.0 (`+omniscient=1`: both hands and the pile's order seen)
 * against itself on N deals, K games each (the bots seeded otherwise every
 * time), at the page's claim rule. Prints the first player's share (the seat
 * advantage left between omniscients: the rules' part), the deals one side
 * wins whoever plays (luck), and the balanced ones (40-60 %), the pool to
 * judge ideas on (docs/1.3-to-oracle-shift.md). Each deal's share goes to
 * tmp/deals-<offset>.json with the `deals` seed that deals it again.
 *
 * Default engine: the 1.2's tree, omniscient, at 400 iterations (the daytime
 * budget); a judgment worth keeping runs at night with `--engine`.
 */
const args = process.argv.slice(2);
applyThreadsOption(args);
const valueOf = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const DEALS = Number(valueOf("--deals", 100));
const PLAYS = Number(valueOf("--plays", 10));
const ENGINE = valueOf("--engine", "ismcts+widen=7+depth=5+core=stfig6+exact=12+omniscient=1@400");
const OFFSET = Number(valueOf("--offset", 0));
const DEALS_SEED = SEED + 7_000_001 * (OFFSET + 1);
// Five deals a task: a game of omniscients at 400 takes half a minute a thread, so smaller tasks keep 18 threads busy.
const CHUNK = 5;

// Every play of a chunk deals the same decks (`deals`); only the bots' seed changes from one play to the next.
const tasks = [];
for (let from = 0; from < DEALS; from += CHUNK) {
  for (let play = 0; play < PLAYS; play += 1) {
    tasks.push({ ...DUEL_ROW, endMode: OFFICIAL_RULES.endMode, keepWinners: true, players: [ENGINE, ENGINE], games: Math.min(CHUNK, DEALS - from), seed: DEALS_SEED + 104729 * (tasks.length + 1), deals: DEALS_SEED + 31 * from, from });
  }
}

const started = Date.now();
let done = 0;
const results = await runPool(new URL("./lib/sim-worker.js", import.meta.url), tasks, {
  onResult: () => {
    done += 1;
    if (done % Math.max(1, Math.round(tasks.length / 10)) === 0) process.stderr.write(`  ${done} / ${tasks.length} lots, ${Math.round((Date.now() - started) / 1000)} s\n`);
  },
});

const firsts = Array.from({ length: DEALS }, () => 0);
results.forEach((result, i) => result.winners.forEach((winner, g) => (firsts[tasks[i].from + g] += winner === null ? 0.5 : Number(winner === 0))));
const judged = judgeDeals(firsts, PLAYS);
const pct = (share) => `${(100 * share).toFixed(1).replace(".", ",")} %`;

console.log(`# Omniscient contre Omniscient — ${DEALS} donnes × ${PLAYS} parties, ${ENGINE}, offset ${OFFSET}\n`);
console.log(`- Premier joueur : ${pct(judged.first)} (${pct(judged.firstInterval[0])} – ${pct(judged.firstInterval[1])}) sur ${DEALS * PLAYS} parties`);
console.log(`- Donnes décidées (un camp gagne au moins 90 % des parties) : ${pct(judged.decided)}`);
console.log(`- Donnes équilibrées (40 à 60 % pour le premier joueur) : ${pct(judged.balanced)}`);
console.log(`- Par dixième de la part du premier joueur : ${judged.tenths.join(" · ")}`);
console.log(`\nDurée : ${Math.round((Date.now() - started) / 1000)} s`);
const out = tmpFile(`deals-${OFFSET}.json`);
await writeFile(out, `${JSON.stringify({ engine: ENGINE, offset: OFFSET, dealsSeed: DEALS_SEED, chunk: CHUNK, ...judged }, null, 1)}\n`);
console.log(`→ ${decodeURIComponent(out.pathname)}`);
