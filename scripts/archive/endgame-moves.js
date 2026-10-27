/**
 * Endgame moves (Sami, 20/10): on the last two searches of the kept duels (tmp/misjudged-endgames.json, pile 1-2),
 * does the 1.2's tree play the move the exact solver rates best over the deals its mover cannot tell apart? Each
 * position is searched again by the 1.2 (`--budget`, 2 000), and every legal move solved on the same deals
 * (endgame-moves-worker.js). Read by band of the tree's estimate: the tree's move (most visited), its best-rated
 * candidate, the core's first, the rollout policy's move, against the solver's best; where the tree misses, how
 * the better move fared in the tree (visits, rank, rate) and what both moves do (joker, third card, fresh border).
 * `node scripts/archive/endgame-moves.js [--per 150] [--budget 2000]`; `--summary` rereads tmp/endgame-moves.json; `--recore` ranks
 * the core's moves again in it (the first run of 20/10 kept `scoreMoves`' unsorted order).
 * EndPimc3 (27/10, src/sim/mcts/pimc.js): `--summary --pimc K` adds, with one card in the pile, the move the solver would
 * choose among the tree's 1 to K most visited — on the same deals as the bench, so an upper bound; `--pimc-cost K
 * [--nodes N]` times that choice on those positions (the tree's visits read back, no search) and counts the solves the
 * node cap stops.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { applyThreadsOption, runPool } from "../lib/cli/pool.js";
import { progress } from "mcts-commun/trace.js";
import { tmpFile } from "../lib/domain/tmp.js";

const args = process.argv.slice(2);
applyThreadsOption(args);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const PER = Number(option("--per", 150));
const BUDGET = Number(option("--budget", 2000));
const DUELS = new URL("../../duels/", import.meta.url);
const OUT = tmpFile("endgame-moves.json");
const BANDS = [["< 20 %", 0, 0.2], ["20-40 %", 0.2, 0.4], ["40-60 %", 0.4, 0.6], ["60-80 %", 0.6, 0.8], ["> 80 %", 0.8, 1.01]];

const slim = (game) => ({ ...game, analysis: undefined, turns: game.turns.map((entry) => ({ ...entry, candidates: undefined, tree: undefined, lab: undefined })) });
const spread = (rows, n) => rows.filter((_, k) => k % Math.max(1, Math.floor(rows.length / n)) === 0).slice(0, n);

function tasksOf() {
  const rows = JSON.parse(readFileSync(tmpFile("misjudged-endgames.json"), "utf8")).filter((row) => row.pile >= 1 && row.pile <= 2);
  const picked = BANDS.flatMap(([band, lo, hi]) => spread(rows.filter((row) => row.rate >= lo && row.rate < hi), BAND_SIZE(band)).map((row) => ({ ...row, band })));
  const games = new Map();
  for (const file of new Set(picked.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  return picked.map((row) => ({ row, log: slim(games.get(row.file)[row.game]), turn: row.turn, budget: BUDGET }));
}

/** The decisive band gets twice the positions. */
function BAND_SIZE(band) {
  return band === "40-60 %" ? 2 * PER : PER;
}

const pc = (part, whole) => `${((100 * part) / Math.max(1, whole)).toFixed(1)} %`;
const mean = (rows, f) => rows.reduce((sum, row) => sum + f(row), 0) / Math.max(1, rows.length);
const EPS = 1e-9;

/** A position read: the solver's best value and the moves each player of the comparison would make. */
function readPosition(position) {
  const moves = position.moves.filter((move) => move.exact !== null);
  if (moves.length !== position.moves.length || moves.length === 0) return null;
  const best = Math.max(...moves.map((move) => move.exact));
  const worst = Math.min(...moves.map((move) => move.exact));
  const visited = moves.filter((move) => move.visits > 0);
  const tree = visited.reduce((a, b) => (b.visits > a.visits ? b : a));
  const rated = visited.filter((move) => move.visits >= 20).reduce((a, b) => (b.rate > a.rate ? b : a), tree);
  const core = moves.find((move) => move.coreRank === 1);
  const policy = moves.find((move) => move.policy);
  const ranked = [...visited].sort((a, b) => b.visits - a.visits);
  return { ...position, moves, best, worst, tree, rated, core, policy, ranked };
}

function picks(label, rows, pick) {
  const right = rows.filter((row) => pick(row).exact >= row.best - EPS).length;
  const loss = mean(rows, (row) => row.best - pick(row).exact);
  return `    ${label.padEnd(34)} meilleur coup ${pc(right, rows.length).padStart(7)} · perte moyenne ${(100 * loss).toFixed(1)} points`;
}

/** Where the tree missed: the solver's best moves, as the tree saw them. */
function misses(rows) {
  const missed = rows.filter((row) => row.tree.exact < row.best - EPS);
  if (missed.length === 0) return ["    aucun coup manqué"];
  const better = (row) => row.ranked.filter((move) => move.exact >= row.best - EPS);
  const firstBetter = (row) => better(row)[0] ?? row.moves.find((move) => move.exact >= row.best - EPS);
  const rank = (row) => (firstBetter(row).visits > 0 ? row.ranked.indexOf(firstBetter(row)) + 1 : 99);
  const ranks = [2, 3, 4, 5, 6, 7, 8].map((r) => `${r}e ${pc(missed.filter((row) => rank(row) === r).length, missed.length)}`).join(" · ");
  const outside = missed.filter((row) => rank(row) > 8).length;
  const higherRate = missed.filter((row) => firstBetter(row).rate !== null && firstBetter(row).rate > row.tree.rate).length;
  const shape = (pick, key) => pc(missed.filter((row) => pick(row)[key]).length, missed.length);
  return [
    `    ${missed.length} manqués, perte moyenne ${(100 * mean(missed, (row) => row.best - row.tree.exact)).toFixed(1)} points`,
    `    rang de visites du meilleur coup : ${ranks} · hors des 8 / jamais visité : ${pc(outside, missed.length)}`,
    `    part de visites du meilleur coup ${(100 * mean(missed.filter((row) => rank(row) <= 8), (row) => firstBetter(row).share)).toFixed(1)} % contre ${(100 * mean(missed, (row) => row.tree.share)).toFixed(1)} % au coup joué · son taux d'arbre plus haut que celui du coup joué : ${pc(higherRate, missed.length)}`,
    `    taux d'arbre : coup joué ${(100 * mean(missed, (row) => row.tree.rate)).toFixed(1)} % (solveur ${(100 * mean(missed, (row) => row.tree.exact)).toFixed(1)}) · meilleur coup ${(100 * mean(missed.filter((row) => firstBetter(row).rate !== null), (row) => firstBetter(row).rate)).toFixed(1)} % (solveur ${(100 * mean(missed, (row) => row.best)).toFixed(1)})`,
    `    le coup joué : joker ${shape((row) => row.tree, "joker")}, 3e carte ${shape((row) => row.tree, "fills")}, borne vierge ${shape((row) => row.tree, "opens")} · le meilleur : joker ${shape(firstBetter, "joker")}, 3e carte ${shape(firstBetter, "fills")}, borne vierge ${shape(firstBetter, "opens")}`,
    `    le meilleur coup était le 1er du cœur : ${pc(missed.filter((row) => firstBetter(row).coreRank === 1).length, missed.length)} · le coup joué l'était : ${pc(missed.filter((row) => row.tree.coreRank === 1).length, missed.length)}`,
  ];
}

function summary(results) {
  const rows = results.map(readPosition).filter(Boolean);
  const lines = [`# Coups de fin de partie : ${rows.length} positions résolues sur ${results.length} (la 1.2@${BUDGET} contre le solveur exact sur les donnes du joueur)`];
  for (const [band] of [["toutes"], ...BANDS]) {
    const at = band === "toutes" ? rows : rows.filter((row) => row.band === band);
    const open = at.filter((row) => row.best - row.worst > EPS);
    lines.push("", `${band} — ${at.length} positions, ${pc(open.length, at.length)} où le coup compte (écart meilleur-pire ${(100 * mean(open, (row) => row.best - row.worst)).toFixed(1)} points)`);
    lines.push(picks("le coup de l'arbre (plus visité)", open, (row) => row.tree), picks("le meilleur taux de l'arbre (≥ 20 visites)", open, (row) => row.rated));
    lines.push(picks("le 1er du cœur (racine)", open, (row) => row.core), picks("le coup de la politique (simulations)", open, (row) => row.policy));
    lines.push(...misses(open));
  }
  return lines.join("\n");
}

/** The core's rank of every move, computed again (cheap: no search, no solver). */
async function recore(results) {
  const { coreRanking } = await import("../lib/workers/endgame-moves-worker.js");
  const { stateAt } = await import("../../src/replay/core/log.js");
  const { legalMoves } = await import("../../src/sim/engine/game.js");
  const games = new Map();
  for (const file of new Set(results.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  return results.map((row) => {
    const state = stateAt(games.get(row.file)[row.game], row.turn);
    const ranking = coreRanking(state, legalMoves(state));
    return { ...row, moves: row.moves.map((move) => ({ ...move, coreRank: ranking.indexOf(move.key) + 1 })) };
  });
}

/** With one card in the pile, the solver choosing among the tree's k most visited (ties to the most visited). */
function pimcLines(results, most) {
  const rows = results.map(readPosition).filter((row) => row && row.pile === 1 && row.best - row.worst > EPS);
  const lines = ["", `EndPimc : pioche 1, ${rows.length} positions où le coup compte (borne haute : le banc juge sur les mêmes donnes)`];
  for (let k = 1; k <= most; k += 1) {
    const pick = (row) => row.ranked.slice(0, k).reduce((a, b) => (b.exact > a.exact + EPS ? b : a));
    const fixed = rows.filter((row) => row.tree.exact < row.best - EPS && pick(row).exact >= row.best - EPS).length;
    const label = `les ${k} premiers de l'arbre au solveur`;
    lines.push(`${picks(label, rows, pick)} · manqués corrigés ${fixed}`);
  }
  return lines;
}

/** `--pimc-cost`: EndPimc's choice timed on every pile-1 position of the bench. */
async function pimcCost(results, k, nodes) {
  const rows = results.filter((row) => row.pile === 1);
  const games = new Map();
  for (const file of new Set(rows.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  const tasks = rows.map((row) => ({ log: slim(games.get(row.file)[row.game]), turn: row.turn, cost: { k, nodes, visits: Object.fromEntries(row.moves.map((move) => [move.key, move.visits])) } }));
  const started = Date.now();
  // Where it stands, for the machine's queue (mcts-commun's progress) and on stderr (the 27/10 run said nothing for 21 min).
  const onProgress = (done) => {
    progress("pimc-cost", done, tasks.length, { unit: "position" });
    if (done % 10 === 0) console.error(`  ${done} / ${tasks.length}, ${Math.round((Date.now() - started) / 1000)} s`);
  };
  const out = await runPool(new URL("../lib/workers/endgame-moves-worker.js", import.meta.url), tasks, { onProgress });
  const times = out.map((entry) => entry.ms).sort((a, b) => a - b);
  const at = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  const complete = out.filter((entry) => entry.complete).length;
  console.log(`EndPimc${k}, ${nodes} nœuds par donne : ${rows.length} positions, terminées ${pc(complete, rows.length)} · temps médian ${Math.round(at(0.5))} ms, p90 ${Math.round(at(0.9))} ms, max ${Math.round(times.at(-1))} ms`);
}

if (args.includes("--pimc-cost")) {
  await pimcCost(JSON.parse(readFileSync(OUT, "utf8")), Number(option("--pimc-cost", 3)), Number(option("--nodes", 400_000)));
} else if (args.includes("--recore")) {
  const results = await recore(JSON.parse(readFileSync(OUT, "utf8")));
  writeFileSync(OUT, JSON.stringify(results));
  console.log(summary(results));
} else if (args.includes("--summary")) {
  const results = JSON.parse(readFileSync(OUT, "utf8"));
  console.log([summary(results), ...(args.includes("--pimc") ? pimcLines(results, Number(option("--pimc", 3))) : [])].join("\n"));
} else {
  const tasks = tasksOf();
  console.log(`${tasks.length} positions à juger`);
  const started = Date.now();
  const results = await runPool(new URL("../lib/workers/endgame-moves-worker.js", import.meta.url), tasks, {
    onProgress: (done) => done % 50 === 0 && console.log(`  ${done} / ${tasks.length}, ${Math.round((Date.now() - started) / 1000)} s`),
  });
  const kept = tasks.map((task, k) => ({ ...task.row, ...results[k] }));
  writeFileSync(OUT, JSON.stringify(kept));
  console.log(summary(kept));
}
