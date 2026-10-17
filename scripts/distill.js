import { readFile, writeFile } from "node:fs/promises";
import { createRng } from "../src/core/random.js";
import { BASE_CORE, DISTILLED, clampUnits, heldOut, valuesAt } from "../src/sim/heuristics/distill.js";
import { DUELS_DIR } from "./lib/domain/game-index.js";
import { applyThreadsOption, runPool, workerCount } from "./lib/cli/pool.js";

/**
 * `npm run distill -- [--minutes 15] [--threads N] [--rebuild] [--keys pairDiscount] [--name pair]`: the 1.0's core
 * tuned on the oracle (Sami, 04/10: a version at 55 % against the V1). Every
 * weight of src/sim/heuristics/distill.js moves at once, by SPSA: each round, every
 * thread probes one random direction — the weights nudged one way, then the
 * other, on the same sample of positions — and the weights move along the
 * directions that put the oracle's move in the core's top 8 more often.
 *
 * The positions: every stable one the oracle read (oracle/positions*.jsonl),
 * cached once in oracle/distill-cache.json (`--rebuild` reads them again). One
 * game in four is kept aside: the result is judged there, against the 1.0's
 * core, before any tree sees it. The mean of the run's second half goes to
 * src/sim/heuristics/distilled-core.js (`ismcts+…+core=dist1`); the run to data/distill.json.
 * `--keys`: only those weights move, the others stay the 1.0's (B3: `--keys
 * pairDiscount`); `--name pair`: src/sim/heuristics/distilled-pair.js and
 * data/distill-pair.json instead, so a core under test is never overwritten.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const minutes = Math.min(20, Number(option("--minutes", 15)));
applyThreadsOption(args);
const ROOT = new URL("../", import.meta.url);
const CACHE = new URL("oracle/distill-cache.json", ROOT);
const WORKER = new URL("./lib/workers/distill-worker.js", import.meta.url);
const SOURCES = ["positions", "positions-v1ref", "positions-banc"];
const SAMPLE = 1500;
const [A0, C0, STABILITY] = [400, 1, 10];
const KEYS = option("--keys", null)?.split(",") ?? null;
const NAME = option("--name", "core");
// A weight left out of `--keys` gets no probe: its step stays 0, so it never moves.
const moving = DISTILLED.map(({ key }) => !KEYS || KEYS.includes(key));
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;

/** A logged game, with only what replaying it needs (stateAt). */
const compact = ({ rules, deck, turns }) => ({ rules, deck, turns: turns.map(({ player, pass, move, drew }) => ({ player, pass, move, drew })) });

const readJsonl = async (name) => (await readFile(new URL(`oracle/${name}.jsonl`, ROOT), "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line));

const usable = (entry) => !entry.skipped && entry.stable !== false && Boolean(entry.move);

/** Every stable position the oracle read, once each. */
async function oracleEntries() {
  const byId = new Map();
  for (const name of SOURCES) for (const entry of (await readJsonl(name)).filter(usable)) if (!byId.has(`${entry.key}|${entry.turn}`)) byId.set(`${entry.key}|${entry.turn}`, entry);
  return [...byId.values()];
}

/** The positions and their games, each duel file read once. */
async function buildCache() {
  const entries = await oracleEntries();
  const games = {};
  for (const file of new Set(entries.map((entry) => entry.file))) {
    const logs = JSON.parse(await readFile(`${DUELS_DIR}${file}`, "utf8")).games;
    for (const entry of entries.filter((e) => e.file === file)) games[entry.key] ??= compact(logs[entry.game]);
  }
  const positions = entries.map((entry) => ({ game: entry.key, turn: entry.turn, move: entry.move, test: heldOut(entry.key) }));
  await writeFile(CACHE, JSON.stringify({ built: new Date().toISOString().slice(0, 16), games, positions }));
  return positions;
}

async function positionsOf() {
  if (!args.includes("--rebuild")) {
    const cached = await readFile(CACHE, "utf8").then(JSON.parse, () => null);
    if (cached) return cached.positions;
  }
  return buildCache();
}

/** `count` distinct indices out of `pool`, drawn with `rng`. */
function sampleOf(pool, count, rng) {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** One SPSA round: a probe per thread on one shared sample, and the mean gradient estimate (score per position). */
async function round(units, t, { train, rng }) {
  const c = C0 / (t + 1) ** 0.101;
  const threads = workerCount();
  const indices = sampleOf(train, SAMPLE, rng);
  const deltas = Array.from({ length: threads }, () => DISTILLED.map((_, i) => (rng.next() < 0.5 ? -1 : 1) * Number(moving[i])));
  const tasks = deltas.map((delta) => ({ cores: [valuesAt(units.map((u, i) => u + c * delta[i])), valuesAt(units.map((u, i) => u - c * delta[i]))], indices }));
  const results = await runPool(WORKER, tasks);
  const margins = results.map(([plus, minus]) => (plus.score - minus.score) / indices.length);
  return DISTILLED.map((_, i) => margins.reduce((sum, d, k) => sum + (d / (2 * c)) * deltas[k][i], 0) / threads);
}

/** Top 1 / 3 / 8 of a core on positions, the work split over the threads. */
async function topsOn(values, indices) {
  const threads = workerCount();
  const chunks = Array.from({ length: threads }, (_, k) => indices.filter((_, i) => i % threads === k));
  const ranks = (await runPool(WORKER, chunks.map((chunk) => ({ cores: [values], indices: chunk })))).flatMap(([result]) => result.ranks);
  const within = (cut) => ranks.filter((rank) => rank > 0 && rank <= cut).length / ranks.length;
  return { 1: within(1), 3: within(3), 8: within(8) };
}

function printTable(rows) {
  console.log("| Poids | 1.0 | Réglé |");
  console.log("| --- | --- | --- |");
  for (const { key, from, to } of rows) console.log(`| ${key} | ${from} | ${to} |`);
}

async function writeCore(values, stamp) {
  const body = JSON.stringify(values, null, 2);
  await writeFile(new URL(`src/sim/heuristics/distilled-${NAME}.js`, ROOT), `/** Written by \`npm run distill\` (${stamp}): the 1.0's core tuned on the oracle's moves (distill.js). */\nexport const DISTILLED_CORE = Object.freeze(${body});\n`);
}

const started = Date.now();
const positions = await positionsOf();
const indexed = positions.map((position, index) => ({ ...position, index }));
const train = indexed.filter((p) => !p.test).map((p) => p.index);
const test = indexed.filter((p) => p.test).map((p) => p.index);
console.log(`# Le cœur du 1.0 réglé sur l'oracle (SPSA) — ${positions.length} positions stables (${test.length} gardées de côté), ${workerCount()} sondes par manche sur ${SAMPLE} positions, ${minutes} min\n`);
const rng = createRng(742);
let units = DISTILLED.map(() => 0);
const history = [];
while (Date.now() - started < minutes * 60_000) {
  const t = history.length;
  const gradient = await round(units, t, { train, rng });
  units = clampUnits(units.map((u, i) => u + (A0 / (t + 1 + STABILITY) ** 0.602) * gradient[i]));
  history.push(units);
  const where = DISTILLED.map(({ key }, i) => [key, units[i].toFixed(2)].join(" ")).join(", ");
  if (t % 10 === 0) console.log(`  manche ${t}, ${((Date.now() - started) / 60_000).toFixed(1)} min : ${where}`);
}
const half = history.slice(Math.floor(history.length / 2));
const tuned = valuesAt(DISTILLED.map((_, i) => half.reduce((sum, u) => sum + u[i], 0) / half.length));
const start = valuesAt(DISTILLED.map(() => 0));
console.log(`\n${history.length} manches. Moyenne de la seconde moitié :\n`);
printTable(DISTILLED.map((entry) => ({ key: entry.key, from: start[entry.in][entry.key], to: tuned[entry.in][entry.key] })));
const [before, after] = [await topsOn(start, test), await topsOn(tuned, test)];
console.log(`\nSur les ${test.length} positions gardées de côté, le coup de l'oracle dans le top 1 / 3 / 8 :`);
console.log(`  ${BASE_CORE} (1.0) : ${pct(before[1])} / ${pct(before[3])} / ${pct(before[8])}`);
console.log(`  réglé       : ${pct(after[1])} / ${pct(after[3])} / ${pct(after[8])}`);
const stamp = `${new Date().toISOString().slice(0, 10)}, ${history.length} rounds of ${workerCount()} probes`;
await writeCore(tuned, stamp);
const report = { built: new Date().toISOString().slice(0, 16), base: BASE_CORE, positions: positions.length, test: test.length, rounds: history.length, sample: SAMPLE, start, tuned, tops: { before, after } };
const reportName = NAME === "core" ? "distill" : `distill-${NAME}`;
await writeFile(new URL(`data/${reportName}.json`, ROOT), `${JSON.stringify({ ...report, keys: KEYS }, null, 1)}\n`);
console.log(`\n${((Date.now() - started) / 60_000).toFixed(1)} min → src/sim/distilled-${NAME}.js, data/${reportName}.json`);
