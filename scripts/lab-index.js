import { readFile, readdir, writeFile } from "node:fs/promises";
import { BOT_LINEUP, V1_ENGINE } from "../src/config/bots.js";
import { normalizeEngine } from "../src/sim/mcts/engine-id.js";
import { backlogFiles } from "./lib/domain/backlog-files.js";
import { pairedInterval, pointsOf } from "./lib/domain/duel-plan.js";
import { DUELS_DIR } from "./lib/domain/game-index.js";

/**
 * `npm run lab-index` (the Labo, lot 2): what the duels already measured, for the page to say of a config it builds
 * « déjà mesurée : … » or « jamais mesurée ». Every game of duels/ is filed under its two engines' one
 * spelling (`normalizeEngine`); each pair of configs gets its games, the first's score and its interval over the deck
 * pairs (`pairedInterval`, as `npm run versus`): the files themselves are read (about a minute), since the index does
 * not say which two games share a deck. The names come from the line-up and the backlog's duel jobs (a job's
 * version is the last column of its id, `VALIDATE_LONG_1_ReplyFpu1` → ReplyFpu1). Written to data/lab-configs.json,
 * served by `/api/lab/configs`.
 */
const OUT = new URL("../data/lab-configs.json", import.meta.url);
const DUEL = /npm run duel -- "([^"]+)" "([^"]+)"/;
// The Expérimental 1.1 left the line-up on 08/10 (src/config/bots.js names its engine in a comment).
const RETIRED = { [V1_ENGINE]: "Expérimental 1.0", "ismcts+widen=7+depth=5+core=stfig6@2000": "Expérimental 1.1" };
const round = (x) => Math.round(x * 10000) / 10000;
const Z = 1.96;

/** A duel job's tested engine (one spelling) and version name, or null. */
function jobName(job) {
  const [, engine] = DUEL.exec(job.command ?? "") ?? [];
  const name = job.id.split("_").at(-1);
  return engine && name !== "@" && !/^\d+$/.test(name) ? [normalizeEngine(engine), name] : null;
}

/** The most frequent name each engine had in the backlog's duel jobs, then the line-up's (which win). */
function namesOf(jobs) {
  const counts = new Map();
  for (const [key, name] of jobs.map(jobName).filter(Boolean)) {
    const named = counts.get(key) ?? new Map();
    counts.set(key, named.set(name, (named.get(name) ?? 0) + 1));
  }
  const names = Object.fromEntries([...counts].map(([key, named]) => [key, [...named].sort((a, b) => b[1] - a[1])[0][0]]));
  for (const [engine, name] of Object.entries(RETIRED)) names[normalizeEngine(engine)] = name;
  for (const bot of Object.values(BOT_LINEUP)) names[normalizeEngine(bot.engine)] = `${bot.label} ${bot.version}`;
  return names;
}

/** The pair's record: the first engine's points in every game, by deck pair. */
function tally(pairs, file, log) {
  const engines = log.players.map((player) => normalizeEngine(player.bot));
  if (engines[0] === engines[1]) return;
  const [a, b] = [...engines].sort();
  const key = `${a}\n${b}`;
  const pair = pairs.get(key) ?? { a, b, games: 0, points: 0, decks: new Map(), files: new Set() };
  const points = pointsOf(log.result.winner, engines.indexOf(a));
  const deck = `${file}|${log.deck.join(" ")}`;
  pair.games += 1;
  pair.points += points;
  pair.files.add(file);
  pair.decks.set(deck, [...(pair.decks.get(deck) ?? []), points]);
  pairs.set(key, pair);
}

function summary({ a, b, games, points, decks, files }) {
  const both = [...decks.values()].filter((scores) => scores.length === 2).map(([x, y]) => (x + y) / 2);
  const [low, high] = pairedInterval(both);
  const last = [...files].sort().at(-1).slice(0, 10);
  return { a, b, games, score: round(points / games), low: round(low), high: round(high), decks: both.length, files: files.size, last };
}

/** A finished duel job's deck pairs, read from its output (« paires : n = 125, moyenne 0.5400, écart-type 0.3019 »). */
async function jobPairs(job) {
  const [, first, second] = DUEL.exec(job.command ?? "") ?? [];
  if (!first || job.status !== "done" || !job.output) return null;
  const text = await readFile(new URL(`../${job.output}`, import.meta.url), "utf8").catch(() => "");
  const found = /paires : n = (\d+), moyenne ([\d.]+), écart-type ([\d.]+)/.exec(text);
  if (!found) return null;
  const [a, b] = [normalizeEngine(first), normalizeEngine(second)];
  const mean = Number(found[2]);
  return { a, b, n: Number(found[1]), mean, sd: Number(found[3]), last: job.doneAt.slice(0, 10) };
}

/**
 * The duels the backlog ran, pooled by pair of configs from their outputs — exactly as their deck pairs would pool:
 * the means weighted by pairs, the variance within and between runs. For the duels whose files left duels/ (or never
 * reached it: another machine's queue).
 */
async function backlogPairs(jobs) {
  const groups = new Map();
  for (const run of await Promise.all(jobs.map(jobPairs))) {
    if (!run || run.a === run.b) continue;
    const [a, b] = [run.a, run.b].sort();
    const mean = a === run.a ? run.mean : 1 - run.mean;
    const key = `${a}
${b}`;
    groups.set(key, [...(groups.get(key) ?? []), { ...run, a, b, mean }]);
  }
  return new Map([...groups].map(([key, runs]) => [key, pooled(runs)]));
}

function pooled(runs) {
  const n = runs.reduce((sum, run) => sum + run.n, 0);
  const mean = runs.reduce((sum, run) => sum + run.n * run.mean, 0) / n;
  const squares = runs.reduce((sum, run) => sum + (run.n - 1) * run.sd ** 2 + run.n * (run.mean - mean) ** 2, 0);
  const half = n > 1 ? Z * Math.sqrt(squares / (n - 1) / n) : 1;
  const last = runs.map((run) => run.last).sort().at(-1);
  return { a: runs[0].a, b: runs[0].b, games: 2 * n, score: round(mean), low: round(Math.max(0, mean - half)), high: round(Math.min(1, mean + half)), decks: n, files: runs.length, last, source: "backlog" };
}

const pairs = new Map();
const files = (await readdir(DUELS_DIR)).filter((name) => name.endsWith(".json") && name !== "index.json");
for (const file of files) {
  for (const log of JSON.parse(await readFile(`${DUELS_DIR}${file}`, "utf8")).games ?? []) if (log.result) tally(pairs, file, log);
}
const queue = backlogFiles();
const jobs = [...(await queue.readArchive()), ...(await queue.readQueue()).jobs];
// Each pair from whichever source holds more of its games: duels/, or the backlog's outputs.
const merged = new Map([...pairs].map(([key, pair]) => [key, { ...summary(pair), source: "duels" }]));
for (const [key, pair] of await backlogPairs(jobs)) if ((merged.get(key)?.games ?? 0) < pair.games) merged.set(key, pair);
const list = [...merged.values()].sort((x, y) => y.games - x.games);
const names = namesOf(jobs);
const note = "npm run lab-index : les duels regroupés par paire de configs (score du premier, a, et fourchette à 95 % sur les paires de donnes), lus dans duels/ ou, s'ils y sont moins nombreux, dans les sorties du backlog (source), et les noms des configs (la gamme, les traitements du backlog).";
await writeFile(OUT, `${JSON.stringify({ note, built: new Date().toISOString().slice(0, 10), names, pairs: list }, null, 1)}\n`);
console.log(`${list.length} paires de configs, ${list.reduce((sum, pair) => sum + pair.games, 0)} parties, ${Object.keys(names).length} noms → data/lab-configs.json`);
