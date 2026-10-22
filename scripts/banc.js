import { readFile, writeFile } from "node:fs/promises";
import { V1_ENGINE } from "../src/config/bots.js";
import { againstBase, bancVerdict, judge, pairedDiff, rankCorrelation, summarizeBanc } from "../src/replay/oracle/banc.js";
import { ORACLE } from "../src/replay/oracle/oracle.js";
import { loadGame, readIndex } from "./lib/domain/game-index.js";
import { stopIfFor } from "../src/schedule/stop.js";
import { applyThreadsOption, runPool } from "./lib/cli/pool.js";

/**
 * `npm run banc -- [<engine>] [--against <engine>] [--positions banc] [--threads N] [--queue [--name B1Lite1]] [--calibrate]`:
 * the similarity bench (Sami, 04/10; src/replay/oracle/banc.js). A version of the V1
 * plays one move on each of the bench's positions, and its moves are judged
 * by the oracle's visits there; against the 1.0 (or `--against`) on the same
 * positions, the gap of oracle value comes with its interval over the pairs,
 * and a verdict: « à pousser », « neutre » or « à écarter ». Minutes, where a
 * decision on whole games takes hours.
 *
 * - `--threads 4` leaves the machine usable (about four times slower).
 * - `--positions games`: instead of the bench's positions, the oracle's own
 *   moves in its whole games (oracle against the 1.0, and the oracle up to
 *   turn 12), judged by the candidates the replay kept — one search, its 5 (or
 *   12) most visited moves; `--turns 1-12` keeps the start of the game.
 * - `--queue`: the version's four long duels against `--against` (the 1.0
 *   by default; the lab plays it at 2 000 iterations since 04/10) go to the
 *   backlog, 250 games each (`--long --games 125 --page --offset 1..4`), with
 *   the stop rule: the second step, the one that decides.
 * - `--calibrate`: every version of data/banc-calibration.json, whose real
 *   duel scores are known — does the bench rank them as the duels do?
 *
 * The reference's moves (the 1.0) are kept in oracle/banc-cache.json and
 * reused: the 1.0 plays the same moves as long as its fingerprint holds. A
 * tested version is always searched again. Results in data/banc.json.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const ROOT = new URL("../", import.meta.url);
const V1 = V1_ENGINE;
const tested = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? V1;
const against = option("--against", V1);
const positionsName = option("--positions", "banc");
const [fromTurn, toTurn = fromTurn] = option("--turns", "1-99").split("-").map(Number);
const inTurns = (entry) => entry.turn >= fromTurn && entry.turn <= toTurn;
const ORACLE_ID = `${ORACLE.engine}@${ORACLE.budget}`;
applyThreadsOption(args);
const BATCH = 20;
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;
const pts = (x) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(2).replace(".", ",")}`;
const keyOf = (entry) => `${entry.key}|${entry.turn}`;
const readJson = (path, fallback) => readFile(new URL(path, ROOT), "utf8").then(JSON.parse, () => fallback);
const writeJson = (path, value) => writeFile(new URL(path, ROOT), `${JSON.stringify(value, null, 1)}\n`);

/** The oracle's moves in its whole games, as bench positions: the replay's candidates are its one search's visits. */
async function gameEntries() {
  const rows = (await readIndex()).filter((row) => row.engines.some((engine) => engine.includes(ORACLE_ID)));
  const entries = [];
  for (const row of rows) {
    const log = await loadGame(row);
    const seat = row.engines.findIndex((engine) => engine.includes(ORACLE_ID));
    // A `phase:N:` player is the oracle only before its switch (state.turn < N, so logged turns up to N).
    const until = Number(/^phase:(\d+):/.exec(row.engines[seat])?.[1] ?? Infinity);
    const own = (entry) => entry.player === seat && entry.turn <= until && entry.move && entry.candidates?.length > 1;
    for (const turn of log.turns.filter(own)) {
      const visits = [turn.candidates.map((c) => ({ move: `${c.card}→${c.border}`, share: c.gain }))];
      entries.push({ key: row.key, file: row.file, game: row.game, turn: turn.turn, visits });
    }
  }
  return entries;
}

async function readEntries() {
  if (positionsName === "games") return (await gameEntries()).filter(inTurns);
  const text = await readFile(new URL(`oracle/positions-${positionsName}.jsonl`, ROOT), "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((entry) => !entry.skipped && entry.visits?.length > 0 && inTurns(entry));
}

/** One move per position for `engine`, in batches grouped by file (each worker reads a file once). */
async function movesOf(engine, entries, known = {}) {
  const todo = entries.filter((entry) => !known[keyOf(entry)]).sort((a, b) => a.file.localeCompare(b.file));
  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push({ entries: todo.slice(i, i + BATCH), engine });
  const results = await runPool(new URL("./lib/workers/banc-worker.js", import.meta.url), batches);
  const moves = { ...known };
  for (const result of results.flat()) moves[`${result.key}|${result.turn}`] = { move: result.move, coreTop: result.coreTop };
  return moves;
}

/** The reference's moves, from the cache when it has them. */
async function referenceMoves(entries) {
  const cache = await readJson("oracle/banc-cache.json", {});
  const moves = await movesOf(against, entries, cache[against] ?? {});
  cache[against] = moves;
  await writeJson("oracle/banc-cache.json", cache);
  return moves;
}

const judged = (entries, moves) => entries.map((entry) => judge(entry, moves[keyOf(entry)]));

function printSummary(label, summary) {
  console.log(`  ${label.padEnd(12)} valeur oracle ${pct(summary.value)} · même coup (positions stables) ${pct(summary.agrees)} · favori dans le top 8 du cœur ${pct(summary.top8)}`);
  for (const phase of summary.phases) console.log(`    ${phase.name.padEnd(12)} ${String(phase.positions).padStart(5)} positions : valeur ${pct(phase.value)}, même coup ${pct(phase.agrees)}`);
}

async function compare() {
  const entries = await readEntries();
  if (entries.length === 0) throw new Error(`Aucune position avec les visites de l'oracle dans oracle/positions-${positionsName}.jsonl`);
  const started = Date.now();
  console.log(`Banc : ${entries.length} positions, ${tested} contre ${against}`);
  const reference = judged(entries, await referenceMoves(entries));
  const rows = tested === against ? reference : judged(entries, await movesOf(tested, entries));
  const [mine, theirs] = [summarizeBanc(rows), summarizeBanc(reference)];
  printSummary("testée", mine);
  printSummary("référence", theirs);
  const gap = pairedDiff(rows, reference);
  const verdict = bancVerdict(gap);
  console.log(`  écart de valeur oracle : ${pts(gap.mean)} points (fourchette à 95 % par paires : ${pts(gap.low)} – ${pts(gap.high)}), ${gap.differ} positions où les deux jouent autrement → ${verdict}`);
  console.log(`  ${((Date.now() - started) / 60000).toFixed(1)} min`);
  const file = await readJson("data/banc.json", { note: "npm run banc : la similitude avec l'oracle, version par version.", runs: {} });
  file.runs[tested] = { built: new Date().toISOString().slice(0, 10), oracle: ORACLE.version, against, positions: entries.length, ...mine, gap, verdict };
  await writeJson("data/banc.json", file);
  return { gap, verdict };
}

async function calibrate() {
  const entries = await readEntries();
  const { versions, via } = await readJson("data/banc-calibration.json", { versions: [] });
  console.log(`Calibration du banc : ${versions.length} versions au résultat connu, ${entries.length} positions`);
  const rows = [];
  for (const version of versions) {
    const summary = summarizeBanc(judged(entries, await movesOf(version.engine, entries)));
    const score = version.against === "1.0" ? againstBase(version.score, via) : version.score;
    rows.push({ name: version.name, engine: version.engine, value: summary.value, top8: summary.top8, early: summary.phases[0].value, score });
    console.log(`  ${version.name.padEnd(14)} valeur oracle ${pct(summary.value)} (début ${pct(summary.phases[0].value)}) · duels ${pct(score)} contre le 0.9`);
  }
  const correlation = { value: rankCorrelation(rows.map((r) => r.value), rows.map((r) => r.score)), early: rankCorrelation(rows.map((r) => r.early), rows.map((r) => r.score)), top8: rankCorrelation(rows.map((r) => r.top8), rows.map((r) => r.score)) };
  console.log(`  corrélation de rang avec les duels : valeur ${correlation.value.toFixed(2)}, valeur au début ${correlation.early.toFixed(2)}, top 8 du cœur ${correlation.top8.toFixed(2)}`);
  const file = await readJson("data/banc.json", { note: "npm run banc : la similitude avec l'oracle, version par version.", runs: {} });
  file.calibration = { built: new Date().toISOString().slice(0, 10), oracle: ORACLE.version, positions: entries.length, rows, correlation };
  await writeJson("data/banc.json", file);
}

/** The four long duels that decide, queued after the backlog's last job. */
async function queueDuels() {
  const path = "data/backlog.json";
  const backlog = await readJson(path, { jobs: [] });
  // The version's name (docs/glossaire.md): `--name B1Lite1`, else its core's.
  const name = option("--name", /core=(\w+)/.exec(tested)?.[1] ?? "variante").replace(/[^\w-]/g, "");
  // The decks of the four duels: offsets 1 to 4, never those of the screen that chose the version (offset 0).
  const offset = (n) => ` --offset ${n + 1}`;
  // Fixed-width columns on the left, the version on the right (docs/glossaire.md, Sami 05/10).
  const ids = [1, 2, 3, 4].map((n) => `VALIDATE_LONG_${n}_${name}`);
  // A series that starts badly stops there (stopIf, src/schedule/stop.js).
  const duel = (n) => ({ id: ids[n], command: `npm run duel -- "${tested}" "${against}" --long --games 125 --page${offset(n)}`, estimate: "30 min", limit: 45, why: `Passée au banc de similitude (npm run banc) : le jeu de donnes ${n + 1} sur 4 des duels longs qui décident (fourchette basse réunie au-dessus de 50 %, npm run versus).`, status: "todo", stopIf: stopIfFor(ids, n + 1) });
  const jobs = [0, 1, 2, 3].map(duel);
  backlog.jobs.push(...jobs);
  // The backlog keeps its own two-space indent.
  await writeFile(new URL(path, ROOT), `${JSON.stringify(backlog, null, 2)}
`);
  console.log(`${jobs.length} duels longs ajoutés au backlog : npm run backlog`);
}

if (args.includes("--calibrate")) await calibrate();
else {
  await compare();
  if (args.includes("--queue")) await queueDuels();
}
