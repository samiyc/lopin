import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { ORACLE, coreRanking } from "../../../src/replay/oracle/oracle.js";
import { strategistBot } from "../../../src/sim/bots.js";
import { EXPERIMENT, coreOf } from "../../../src/sim/heuristics/experimental.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { loadGame, readIndex } from "./game-index.js";
import { runPool } from "../cli/pool.js";

/**
 * The oracle asked about a core other than the 0.9's (03/10, Sami: after a
 * day of 10-minute screens that did not hold, judge positions, not noisy
 * duel scores).
 *
 * - `rerank(name)` (`npm run oracle -- --summary --core stfig6`): the
 *   positions already read, ranked again by that core — is the oracle's move
 *   in its top 3, its top 8, more often than in the 0.9's? A core that moved
 *   towards the oracle shows it here, without one more search.
 * - `disagree(name)` (`npm run oracle -- --disagree stfig6`): in the duels that
 *   core played against the 0.9, the turns 5 to 16 where the two cores'
 *   favourites differ; the oracle searches each twice and says which it
 *   plays. Results in oracle/disagree-<name>.jsonl, summary in
 *   data/oracle-disagree.json.
 */
const ROOT = new URL("../../../", import.meta.url);
const TURNS = Object.freeze({ from: 5, to: 16 });
const BASE = "ismcts+widen=3+depth=5@800";
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;
const labelOf = (spec, move) => `${formatCard(spec, move.card)}→${move.border + 1}`;

/** A core's moves at a position, best first, as labels. */
function rankingOf(core, state) {
  return coreRanking(strategistBot(createRng(1), core).scoreMoves(state, legalMoves(state), { keepAll: true })).map((move) => labelOf(state.spec, move));
}

const readJsonl = async (url) => (await readFile(url, "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line));

/** The share of `ranks` at or under each cut-off. */
const within = (ranks, cut) => ranks.filter((rank) => rank > 0 && rank <= cut).length / Math.max(1, ranks.length);

/** The positions read, without those where the oracle's two searches differ, with their states. */
async function readPositions() {
  const positions = (await readJsonl(new URL("oracle/positions.jsonl", ROOT))).filter((entry) => !entry.skipped && entry.stable !== false);
  const states = [];
  for (const entry of positions) states.push(stateAt(await loadGame(entry), entry.turn));
  return { positions, states };
}

/** The rank of the oracle's move for `name`'s core, position by position. */
const ranksFor = (name, { positions, states }) => positions.map((entry, i) => rankingOf(coreOf(name), states[i]).indexOf(entry.move) + 1);

export async function rerank(name, read = null) {
  const { positions, states } = read ?? (await readPositions());
  const ranks = { base: positions.map((entry) => entry.rank), alt: ranksFor(name, { positions, states }) };
  const rows = [1, 3, 8].map((cut) => ({ cut, base: within(ranks.base, cut), alt: within(ranks.alt, cut) }));
  console.log(`Le coup de l'oracle, classé par le cœur du 0.9 et par « ${name} » (${positions.length} positions, sans celles où ses deux recherches divergent) :`);
  for (const row of rows) console.log(`  dans le top ${row.cut} : ${pct(row.base)} pour le 0.9, ${pct(row.alt)} pour ${name}`);
  return { core: name, positions: positions.length, rows };
}

/** Spearman's rank correlation of two lists (no ties expected). */
function spearman(xs, ys) {
  const ranks = (list) => list.map((x) => list.filter((y) => y < x).length + (list.filter((y) => y === x).length + 1) / 2);
  const [rx, ry] = [ranks(xs), ranks(ys)];
  const n = xs.length;
  return 1 - (6 * rx.reduce((sum, r, i) => sum + (r - ry[i]) ** 2, 0)) / (n * (n * n - 1));
}

/**
 * `--bench`: each core's agreement with the oracle beside its long duels'
 * score against the 0.9 (data/versus.json, by label). The 0.9's core is the
 * 50 % point. If the agreement orders the cores as the duels do, it can sort
 * an idea in minutes before it gets duels.
 */
const CUTS = [1, 3, 8];
const topsOf = (ranks) => Object.fromEntries(CUTS.map((cut) => [cut, within(ranks, cut)]));

/** A core's line of the bench: its agreement with the oracle, and its duels if it has some. */
function benchRow(core, ranks, duel = null) {
  const measured = duel ? { score: duel.score, low: duel.low, high: duel.high, timed: duel.a.includes("@t") } : { score: null };
  return { core, ...measured, top: topsOf(ranks) };
}

function printBench(rows, positions) {
  console.log(`Le coup de l'oracle dans le top 1 / 3 / 8 de chaque cœur (${positions} positions), et son score en duels longs contre le 0.9 :`);
  for (const row of rows) {
    const timed = row.timed ? " (à temps égal)" : "";
    const duel = row.score === null ? "—" : pct(row.score) + timed;
    console.log(`  ${row.core.padEnd(10)} ${CUTS.map((cut) => pct(row.top[cut]).padStart(7)).join(" ")}   duels ${duel}`);
  }
}

export async function benchCores(names) {
  const read = await readPositions();
  const { duels } = JSON.parse(await readFile(new URL("data/versus.json", ROOT), "utf8"));
  const rows = [benchRow("0.9", read.positions.map((entry) => entry.rank), { score: 0.5, low: null, high: null, a: "" })];
  for (const name of names) rows.push(benchRow(name, ranksFor(name, read), duels[name]));
  printBench(rows, read.positions.length);
  const measured = rows.filter((row) => row.score !== null);
  const correlation = Object.fromEntries(CUTS.map((cut) => [cut, spearman(measured.map((row) => row.top[cut]), measured.map((row) => row.score))]));
  const cells = CUTS.map((cut) => `top ${cut} ${correlation[cut].toFixed(2)}`);
  console.log(`  corrélation de rang avec les duels : ${cells.join(", ")}`);
  const bench = { built: new Date().toISOString().slice(0, 10), oracle: ORACLE.version, positions: read.positions.length, rows, correlation };
  await writeFile(new URL("data/oracle-bench.json", ROOT), `${JSON.stringify(bench, null, 1)}\n`);
  return bench;
}

/** The positions of the duels `name` played against the 0.9 where the two cores' favourites differ. */
async function disagreements(name) {
  const alt = `ismcts+widen=3+depth=5+core=${name}@800`;
  const rows = (await readIndex()).filter((row) => row.engines.includes(alt) && row.engines.includes(BASE));
  const [baseCore, altCore] = [EXPERIMENT, coreOf(name)];
  const found = [];
  for (const row of rows) {
    const log = await loadGame(row);
    for (let turn = TURNS.from; turn <= Math.min(TURNS.to, log.turns.length); turn += 1) {
      const state = stateAt(log, turn);
      const [base, other] = [rankingOf(baseCore, state)[0], rankingOf(altCore, state)[0]];
      if (base !== other) found.push({ row: { key: row.key, file: row.file, game: row.game }, turn, favourites: { base, alt: other } });
    }
  }
  return { found, games: rows.length };
}

/** A fixed shuffle (by key), so a run cut short reads an even sample rather than the first games only. */
const spread = (task) => `${task.row.key}|${task.turn}`.split("").reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);

export async function disagree(name, { minutes, budget }) {
  await mkdir(new URL("oracle/", ROOT), { recursive: true });
  const out = new URL(`oracle/disagree-${name}.jsonl`, ROOT);
  const done = new Set((await readJsonl(out)).map((entry) => `${entry.key}|${entry.turn}`));
  const { found, games } = await disagreements(name);
  const tasks = found.filter((task) => !done.has(`${task.row.key}|${task.turn}`)).map((task) => ({ ...task, budget })).sort((a, b) => spread(a) - spread(b));
  console.log(`${games} parties, tours ${TURNS.from}-${TURNS.to} : ${found.length} positions où le cœur du 0.9 et « ${name} » préfèrent un coup différent ; ${tasks.length} à lire (${done.size} déjà faites)`);
  const started = Date.now();
  let count = 0;
  await runPool(new URL("../workers/disagree-worker.js", import.meta.url), tasks, {
    shouldStop: () => Date.now() - started > minutes * 60_000,
    onResult: (result) => {
      count += 1;
      appendFile(out, `${JSON.stringify(result)}\n`);
      if (count % 25 === 0) console.log(`  ${count} positions, ${((Date.now() - started) / 1000 / count).toFixed(1)} s chacune sur tous les fils`);
    },
  });
  return summarizeDisagree(name, { total: found.length, budget });
}

export async function summarizeDisagree(name, { total = null, budget = ORACLE.budget } = {}) {
  const entries = await readJsonl(new URL(`oracle/disagree-${name}.jsonl`, ROOT));
  const stable = entries.filter((entry) => entry.verdict !== "unstable");
  const share = (list, verdict) => list.filter((entry) => entry.verdict === verdict).length / Math.max(1, list.length);
  const byTurns = [[5, 8], [9, 12], [13, 16]].map(([from, to]) => {
    const list = stable.filter((entry) => entry.turn >= from && entry.turn <= to);
    return { turns: `${from}-${to}`, positions: list.length, alt: share(list, "alt"), base: share(list, "base"), other: share(list, "other") };
  });
  const summary = { core: name, built: new Date().toISOString().slice(0, 10), oracle: `${ORACLE.engine}@${budget}`, found: total, read: entries.length, stable: stable.length, alt: share(stable, "alt"), base: share(stable, "base"), other: share(stable, "other"), byTurns };
  console.log(`\nL'oracle, là où le 0.9 et « ${name} » ne sont pas d'accord : ${entries.length} positions lues, ${stable.length} où ses deux recherches s'accordent`);
  console.log(`  il joue le coup de ${name} : ${pct(summary.alt)} ; celui du 0.9 : ${pct(summary.base)} ; un troisième : ${pct(summary.other)}`);
  for (const row of byTurns) console.log(`  tours ${row.turns.padEnd(6)} ${String(row.positions).padStart(4)} positions : ${name} ${pct(row.alt)}, 0.9 ${pct(row.base)}, autre ${pct(row.other)}`);
  const path = new URL("data/oracle-disagree.json", ROOT);
  const kept = await readFile(path, "utf8").then(JSON.parse, () => ({ note: "npm run oracle -- --disagree <cœur> : là où un cœur et celui du 0.9 préfèrent des coups différents, celui que joue l'oracle.", cores: {} }));
  kept.cores[name] = summary;
  await writeFile(path, `${JSON.stringify(kept, null, 1)}\n`);
  return summary;
}
