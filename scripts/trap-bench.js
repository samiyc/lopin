import { readFile, writeFile } from "node:fs/promises";
import { FAMILIES } from "../src/sim/puzzles/traps.js";
import { applyThreadsOption, runPool } from "./lib/cli/pool.js";
import { tmpFile } from "./lib/domain/tmp.js";

/**
 * `npm run trap-bench -- [<core>] [--build --games N --from S --minutes M] [--threads N|max]`:
 * the trap bench (Sami, 07/10). The endgames the tree's rollouts play are
 * core-against-core games of the page's rule; where the pile is empty and the
 * position is won, the 1.1's rollout core either keeps the win or falls into
 * a trap. Built a few thousand games at a time (`--build`, seeds from `--from`),
 * appended to tmp/trap-bench.json — every trap kept whole with its winning
 * moves, one sound position in three as a control — towards 5 000 traps.
 *
 * Without `--build`, a core (`stfig6` by default, the 1.2's `stfig6ej`…) plays
 * every kept position: how many traps it avoids, family by family, and how
 * many sound positions it breaks. Seconds, where a long duel takes hours: a
 * screen for a core, never a verdict. Results in data/trap-bench-results.json.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
applyThreadsOption(args);
const BENCH = tmpFile("trap-bench.json");
const RESULTS = new URL("../data/trap-bench-results.json", import.meta.url);
const WORKER = new URL("./lib/workers/trap-bench-worker.js", import.meta.url);
const readJson = (url, fallback) => readFile(url, "utf8").then((text) => JSON.parse(text), () => fallback);
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;

async function build() {
  const games = Number(option("--games", 2000));
  const from = Number(option("--from", 1));
  const until = Date.now() + Math.min(110, Number(option("--minutes", 100))) * 60_000;
  const tasks = [];
  for (let seed = from; seed < from + games; seed += 25) tasks.push({ kind: "build", seeds: Array.from({ length: Math.min(25, from + games - seed) }, (_, i) => seed + i), until });
  const tallies = (await runPool(WORKER, tasks, { shouldStop: () => Date.now() > until })).filter(Boolean);
  const sum = (key) => tallies.reduce((total, tally) => total + (Number.isFinite(tally[key]) ? tally[key] : 0), 0);
  const bench = await readJson(BENCH, { note: "npm run trap-bench : les fins de partie cœur contre cœur où le cœur du 1.1 se trompe (traps), et des positions saines (controls).", runs: [], traps: [], controls: [] });
  const run = { at: new Date().toISOString(), from, games: sum("games"), positions: sum("sound") + sum("trap") + sum("lost") + sum("deep") + sum("skip"), won: sum("sound") + sum("trap"), traps: sum("trap"), deep: sum("deep") };
  bench.runs.push(run);
  bench.traps.push(...tallies.flatMap((tally) => tally.traps));
  bench.controls.push(...tallies.flatMap((tally) => tally.controls));
  await writeFile(BENCH, `${JSON.stringify(bench)}\n`);
  console.log(`${run.games} parties (graines ${from} à ${from + run.games - 1}), ${run.positions} positions pioche vide, ${run.won} gagnées, ${run.traps} pièges (${pct(run.traps / run.won)}), ${run.deep} trop profondes`);
  console.log(`Le banc : ${bench.traps.length} pièges, ${bench.controls.length} positions saines → tmp/trap-bench.json`);
}

async function judge() {
  const core = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "stfig6";
  const bench = await readJson(BENCH, null);
  if (!bench) throw new Error("Pas de banc : npm run trap-bench -- --build d'abord");
  const records = [...bench.traps, ...bench.controls];
  const tasks = [];
  for (let i = 0; i < records.length; i += 200) tasks.push({ kind: "judge", core, records: records.slice(i, i + 200) });
  const wins = (await runPool(WORKER, tasks)).flat();
  const trapWins = wins.slice(0, bench.traps.length);
  const controlWins = wins.slice(bench.traps.length);
  const families = Object.entries(FAMILIES).map(([family, label]) => {
    const own = bench.traps.map((trap, i) => ({ trap, won: trapWins[i] })).filter(({ trap }) => trap.family === family);
    return { family, label, traps: own.length, avoided: own.filter(({ won }) => won).length };
  });
  const result = { at: new Date().toISOString(), core, traps: trapWins.length, avoided: trapWins.filter(Boolean).length, controls: controlWins.length, broken: controlWins.filter((won) => !won).length, families };
  const file = await readJson(RESULTS, { note: "npm run trap-bench <cœur> : les pièges évités et les positions saines cassées, cœur par cœur.", cores: {} });
  file.cores[core] = result;
  await writeFile(RESULTS, `${JSON.stringify(file, null, 1)}\n`);
  console.log(`${core} : ${result.avoided} pièges évités sur ${result.traps} (${pct(result.avoided / result.traps)}) ; ${result.broken} positions saines cassées sur ${result.controls} (${pct(result.broken / result.controls)})`);
  for (const f of families.filter(({ traps }) => traps > 0)) console.log(`  ${String(f.avoided).padStart(5)} / ${String(f.traps).padEnd(5)} ${f.label}`);
}

if (args.includes("--build")) await build();
else await judge();
