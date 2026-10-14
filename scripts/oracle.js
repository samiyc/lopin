import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { ORACLE, oracleOf } from "../src/replay/oracle.js";
import { readIndex } from "./lib/game-index.js";
import { confirmGaps, summarizeConfirm } from "./lib/oracle-confirm.js";
import { benchCores, disagree, rerank, summarizeDisagree } from "./lib/oracle-cores.js";
import { runPool } from "./lib/pool.js";

/**
 * `npm run oracle -- [--minutes 240] [--games N] [--budget 20000] [--turns 15,16,20,21,25,26 | --at last-column] [--all] [--hands medium]`:
 * the oracle on the kept games (Sami, 03/10; src/replay/oracle.js). Each
 * position — the turns given, by default 15-16, 20-21 and 25-26, so both
 * players — gets the core's ranking and two oracle searches over every legal
 * move; a gap is the oracle's move, the same in both runs, outside the core's
 * top 3.
 *
 * With `--at last-column`, the positions are instead, for each player, the
 * move that put its first card on its last empty border (`columns` in the
 * index, src/replay/game-analysis.js): does the oracle open it too, or play
 * elsewhere? (Sami, 03/10.)
 *
 * Positions come from the 0.9's games against itself in duels/, then with
 * `--all` from every game between bots of equal strength. Each result is
 * appended to oracle/positions.jsonl as it lands, and a new run skips the
 * positions already there: a run cut short loses nothing. `--minutes` stops
 * taking new positions after that long. The gaps and the rates by turn and
 * by player go to data/oracle-diffs.json; `--summary` rebuilds it alone.
 *
 * `--confirm [--seeds 6] [--out <name>]`: the gaps played out instead (scripts/lib/oracle-confirm.js),
 * verdict in data/oracle-confirm.json (data/oracle-confirm-<name>.json for another corpus).
 *
 * `--oracle 2` (Sami, 14/10): Oracle2 instead of the frozen one, the same search with the 1.2's core,
 * solver and width (`ORACLES` in src/replay/oracle.js); its lines carry `oracle: 2`.
 *
 * Another corpus (03/10, the V1 + oracle reference): `--source <A>,<B>` reads the
 * games those two engines played against each other instead, into
 * oracle/positions-<out>.jsonl (`--out`, summary in data/oracle-diffs-<out>.json);
 * `--turns 1-30` takes a range; `--runs 1|2` makes always one search, or
 * always two (the second otherwise only checks a gap); `--rank <core>` ranks
 * the moves with that core rather than the 0.9's. Each line carries the
 * oracle's version (`ORACLE.version`): its opinions stay a reference until it
 * plays a move differently.
 *
 * `--bench <core>,<core>…`: the positions ranked by each core, beside the
 * score its long duels against the 0.9 got (data/versus.json) — does the
 * agreement with the oracle order the cores the way the duels do?
 * data/oracle-bench.json.
 *
 * `--core <name>` (with `--summary`): the positions ranked again by another
 * core, to see whether it moved towards the oracle. `--disagree <name>`: the
 * oracle where that core and the 0.9's disagree, in the duels they played
 * (scripts/lib/oracle-cores.js); `--disagree <name> --summary` rebuilds its
 * summary alone.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const minutes = Number(option("--minutes", Infinity));
// `--oracle 2` (Sami, 14/10): Oracle2, the search with the 1.2's core, solver and width (src/replay/oracle.js).
const oracle = oracleOf(option("--oracle", "1"));
const budget = Number(option("--budget", oracle.budget));
/** "15,16,20" or "1-30". */
const parseTurns = (text) => text.split(",").flatMap((part) => {
  const [from, to = from] = part.split("-").map(Number);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
});
const turns = parseTurns(option("--turns", ORACLE.turns.join(",")));
// "A,B" or several pairs "A,B;C,D": the games played exactly by those two (A,A for a bot against itself).
const source = option("--source", null)?.split(";").map((pair) => pair.split(",")) ?? null;
const out = option("--out", null);
const runs = Number(option("--runs", 0)) || null;
const rank = option("--rank", null);
const keep = Number(option("--keep", 0)) || null;
/** `--spread`: a fixed shuffle by key, so a pass cut short by `--minutes` reads an even sample, not the first games only. */
const shuffleKey = (task) => `${task.row.key}|${task.turn}`.split("").reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);
const games = Number(option("--games", Infinity));
const hands = option("--hands", null);
const at = option("--at", null);
const ROOT = new URL("../", import.meta.url);
const OUT = new URL(out ? `oracle/positions-${out}.jsonl` : "oracle/positions.jsonl", ROOT);
const DIFFS = new URL(out ? `data/oracle-diffs-${out}.json` : "data/oracle-diffs.json", ROOT);
const WEAK_BOTS = /^(basique|stratege)@/;
const SELF = "experimental@0.9";

async function readPositions() {
  const text = await readFile(OUT, "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

/** The games to read: the 0.9 against itself first, then (`--all`) every other game between equals. */
/** Did these two play this game, one per seat, by engine id or tag? */
function playedExactly(row, [a, b]) {
  const as = (seat, id) => row.players[seat] === id || row.engines[seat] === id;
  return (as(0, a) && as(1, b)) || (as(0, b) && as(1, a));
}

async function rowsToRead() {
  if (source) return (await readIndex()).filter((row) => source.some((pair) => playedExactly(row, pair))).slice(0, games);
  const rows = (await readIndex()).filter((row) => !row.players.some((player) => WEAK_BOTS.test(player)));
  const self = rows.filter((row) => row.players.every((player) => player === SELF));
  const others = args.includes("--all") ? rows.filter((row) => !self.includes(row)) : [];
  return [...self, ...others].filter((row) => !hands || row.handClasses.every((kind) => kind === hands)).slice(0, games);
}

const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;

/** Rates by group: positions, stable, gaps (outside the top 3), unseen (outside the top 8). */
function rates(positions, groupOf) {
  const groups = new Map();
  for (const position of positions.filter((entry) => !entry.skipped)) {
    const group = groups.get(groupOf(position)) ?? { positions: 0, checked: 0, stable: 0, gaps: 0, unseen: 0 };
    group.positions += 1;
    group.checked += position.stable === null ? 0 : 1;
    group.stable += position.stable === true ? 1 : 0;
    group.gaps += position.gap ? 1 : 0;
    group.unseen += position.unseen ? 1 : 0;
    groups.set(groupOf(position), group);
  }
  return Object.fromEntries([...groups].sort(([a], [b]) => String(a).localeCompare(String(b), "fr", { numeric: true })));
}

function printRates(title, table) {
  console.log(title);
  for (const [name, g] of Object.entries(table)) console.log(`  ${String(name).padEnd(14)} ${String(g.positions).padStart(5)} positions, candidats ${pct(g.checked / g.positions)} dont stables ${pct(g.stable / Math.max(1, g.checked))}, écarts hors top 3 ${pct(g.gaps / g.positions)}, hors top 8 ${pct(g.unseen / g.positions)}`);
}

/** On the move onto the last empty border: how often the oracle plays elsewhere, and how often it disagrees with the 0.9. */
function reportLastColumn(entries) {
  const share = (test) => pct(entries.filter(test).length / entries.length);
  console.log(`Au coup qui remplit la dernière colonne vide : ${entries.length} positions`);
  console.log(`  l'oracle ouvre aussi une colonne vide : ${share((entry) => entry.opens.oracle)} ; il joue ailleurs : ${share((entry) => !entry.opens.oracle)}`);
  console.log(`  l'oracle joue le coup du 0.9 : ${share((entry) => entry.move === entry.played)} ; écart stable hors du top 3 du cœur : ${share((entry) => entry.gap)}`);
}

/** On the gaps: how often each trait is in the oracle's move, and in the core's favourite. The biggest differences first. */
function traitGaps(gaps) {
  const counts = new Map();
  for (const gap of gaps) {
    for (const [side, traits] of [["oracle", gap.traits.oracle], ["core", gap.traits.core]]) {
      for (const trait of traits) {
        const count = counts.get(trait) ?? { oracle: 0, core: 0 };
        count[side] += 1;
        counts.set(trait, count);
      }
    }
  }
  return [...counts]
    .map(([trait, { oracle, core }]) => ({ trait, oracle: oracle / gaps.length, core: core / gaps.length }))
    .sort((a, b) => Math.abs(b.oracle - b.core) - Math.abs(a.oracle - a.core));
}

/** The median time of a position, turn by turn: what an oracle game costs (one search a position with `--runs 1`). */
function msByTurn(positions) {
  const byTurn = new Map();
  for (const entry of positions.filter((position) => position.ms)) byTurn.set(entry.turn, [...(byTurn.get(entry.turn) ?? []), entry.ms]);
  const median = (list) => [...list].sort((x, y) => x - y)[list.length >> 1];
  const table = Object.fromEntries([...byTurn].sort(([x], [y]) => x - y).map(([turn, list]) => [turn, { positions: list.length, ms: median(list) }]));
  const cells = Object.entries(table).map(([turn, row]) => `tour ${turn} ${(row.ms / 1000).toFixed(0)} s`);
  console.log(`Temps médian d'une position (un fil) : ${cells.join(", ")}`);
  return table;
}

async function summarize() {
  const positions = await readPositions();
  const byTurn = rates(positions, (entry) => `tour ${entry.turn}`);
  const byPlayer = rates(positions, (entry) => (entry.starter ? "a commencé" : "second"));
  const lastColumn = positions.filter((entry) => entry.at === "last-column" && !entry.skipped);
  if (lastColumn.length > 0) reportLastColumn(lastColumn);
  const gaps = positions.filter((entry) => entry.gap);
  printRates(`${positions.length} positions lues, ${gaps.length} écarts stables hors du top 3 du cœur`, byTurn);
  printRates("Par joueur", byPlayer);
  const traits = traitGaps(gaps);
  console.log(`Les traits des écarts : coup de l'oracle / premier coup du cœur`);
  for (const row of traits.slice(0, 10)) console.log(`  ${pct(row.oracle)} / ${pct(row.core)}  ${row.trait}`);
  // The gaps themselves stay in oracle/positions.jsonl: here only what they add up to.
  const summary = { built: new Date().toISOString().slice(0, 10), oracle: oracle.version, engine: oracle.engine, budget, positions: positions.length, gaps: gaps.length, byTurn, byPlayer, traits };
  summary.ms = msByTurn(positions);
  const kept = await readFile(DIFFS, "utf8").then((text) => JSON.parse(text).cores, () => undefined);
  const core = option("--core", null);
  summary.cores = core ? { ...kept, [core]: await rerank(core) } : kept;
  await writeFile(DIFFS, `${JSON.stringify(summary, null, 1)}\n`);
}

/** The positions of a game to read: the fixed turns, or each player's move onto its last empty border. */
function turnsOf(row) {
  if (at === "last-column") return (row.columns ?? []).filter((turn) => Number.isInteger(turn) && turn > 0);
  return turns.filter((turn) => turn <= row.turns);
}

async function hunt() {
  await mkdir(new URL("oracle/", ROOT), { recursive: true });
  const done = new Set((await readPositions()).map((entry) => `${entry.key}|${entry.turn}`));
  const tasks = (await rowsToRead())
    .flatMap((row) => turnsOf(row).map((turn) => ({ row: { key: row.key, file: row.file, game: row.game, handClasses: row.handClasses }, turn, budget, runs, rank, keep, at: at ?? "tours fixes", oracle: oracle.version })))
    .filter((task) => !done.has(`${task.row.key}|${task.turn}`));
  if (args.includes("--spread")) tasks.sort((x, y) => shuffleKey(x) - shuffleKey(y));
  const started = Date.now();
  const tally = { done: 0, gaps: 0 };
  const cap = Number.isFinite(minutes) ? `${minutes} min au plus` : "sans limite de temps";
  console.log(`${tasks.length} positions à lire (${done.size} déjà faites), oracle ${oracle.version} ${oracle.engine}@${budget}, ${cap}`);
  await runPool(new URL("./lib/oracle-worker.js", import.meta.url), tasks, {
    shouldStop: () => Date.now() - started > minutes * 60_000,
    onResult: (result) => {
      tally.done += 1;
      tally.gaps += result.gap ? 1 : 0;
      appendFile(OUT, `${JSON.stringify(result)}\n`);
      if (tally.done % 50 === 0) console.log(`  ${tally.done} positions, ${((Date.now() - started) / 1000 / tally.done).toFixed(1)} s par position (sur tous les fils), ${tally.gaps} écarts, ${((Date.now() - started) / 60_000).toFixed(0)} min`);
    },
  });
  console.log(`${tally.done} positions lues en ${((Date.now() - started) / 60_000).toFixed(1)} min.\n`);
}

const against = option("--disagree", null);
if (args.includes("--bench")) {
  await benchCores(option("--bench", "").split(","));
} else if (args.includes("--confirm")) {
  // `--out <name>`: the gaps of oracle/positions-<name>.jsonl (the 1.2's corpus of 14/10), not the 0.9's.
  await confirmGaps({ minutes, seeds: Number(option("--seeds", 6)), out });
  await summarizeConfirm({ out });
} else if (against) {
  await (args.includes("--summary") ? summarizeDisagree(against, { budget }) : disagree(against, { minutes, budget }));
} else {
  if (!args.includes("--summary")) await hunt();
  await summarize();
}
