/**
 * The « sure » endgames lost to the rules' gap (Sami, 28/10, docs/priorites-1.3.md § 15): the positions of
 * tmp/sure-lost.jsonl (scripts/archive/sure-lost.js) won at `final` and lost at `claim-end` over the mover's deals,
 * every legal move solved at the game's rule (sure-lost-moves-worker.js). Did a move win more deals than the one
 * played, and where did the tree rank it? That tells whether a search at the game's rule could have saved them.
 * A queue job (mcts-commun docs/backlog.md, « Recommandations aux projets »): `--from K --count N --out F` measures a
 * slice, each position appended to F as it lands, its progress traced, a slice started again keeping what F holds;
 * `--summary F…` makes the table of the slices. `--nodes N` caps the solver a deal (400 000 by default).
 *   node scripts/archive/sure-lost-moves.js --from 0 --count 43 --out tmp/sure-lost-moves-0.jsonl
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { progress } from "mcts-commun/trace.js";
import { applyThreadsOption, runPool } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const args = process.argv.slice(2);
applyThreadsOption(args);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const DUELS = new URL("../../duels/", import.meta.url);
const NODES = Number(option("--nodes", 400_000));

/** The lines of a results file that parse (the last one cut, its run stopped while writing it, is left out). */
function linesOf(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").flatMap((line) => {
    try {
      return line ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}

const keyOf = (row) => `${row.file}#${row.game}#${row.turn}`;

/** sure-lost.js's « règle »: a sure position lost, its deals won at `final` (75 %+), not at `claim-end`, 25 points apart. */
function ruleCase(row) {
  const { final, "claim-end": claim } = row.exact;
  return row.kind === "sûre perdue" && final !== null && claim !== null && final >= 0.75 && claim < 0.75 && final - claim >= 0.25;
}

/** What `stateAt` replays, the logged candidates of the turn kept (the tree's ranking). */
const slim = (game, turn) => ({ ...game, analysis: undefined, turns: game.turns.map((entry) => ({ ...entry, candidates: entry.turn === turn ? entry.candidates : undefined, tree: undefined, lab: undefined })) });

function tasksOf(from, count) {
  const rows = linesOf(tmpFile("sure-lost.jsonl")).filter(ruleCase).slice(from, from + count);
  const games = new Map();
  for (const file of new Set(rows.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  return rows.map((row) => ({ row, log: slim(games.get(row.file)[row.game], row.turn), turn: row.turn, nodes: NODES }));
}

const pc = (part, whole) => `${((100 * part) / Math.max(1, whole)).toFixed(1)} %`;

/** One position read: the played move's share, the best share, and the best move's rank in the tree. */
function readOf(row) {
  const played = row.moves.find((m) => m.card === row.played.card && m.border === row.played.border);
  const best = row.moves[0];
  const better = row.moves.filter((m) => m.share !== null && m.share > played.share);
  const bestRank = better.length > 0 ? Math.min(...better.filter((m) => m.share === best.share).map((m) => m.rank ?? Infinity)) : null;
  return { played: played.share, best: best.share, saved: better.length > 0, bestRank, lost: played.share === 0 };
}

function summary(rows) {
  const read = rows.filter((row) => row.deals > 0).map(readOf);
  const saved = read.filter((r) => r.saved);
  const mean = (list, f) => list.reduce((sum, r) => sum + f(r), 0) / Math.max(1, list.length);
  const ranked = (test) => `${saved.filter(test).length} (${pc(saved.filter(test).length, saved.length)})`;
  return [
    `${rows.length} positions perdues par l'écart des règles, ${read.length} résolues (${rows.length - read.length} au-delà du plafond)`,
    `  le coup joué gagne ${(100 * mean(read, (r) => r.played)).toFixed(1)} % des donnes à claim-end, le meilleur coup ${(100 * mean(read, (r) => r.best)).toFixed(1)} %`,
    `  un autre coup gagne plus de donnes : ${saved.length} (${pc(saved.length, read.length)}) ; aucun coup ne gagne : ${read.filter((r) => r.best === 0).length}`,
    `  rang du meilleur dans l'arbre : 2e ${ranked((r) => r.bestRank === 2)} · 3e ${ranked((r) => r.bestRank === 3)} · 4e-8e ${ranked((r) => r.bestRank >= 4 && r.bestRank <= 8)} · hors des candidats ${ranked((r) => r.bestRank === null || r.bestRank > 8)}`,
  ].join("\n");
}

async function slice() {
  const out = option("--out", null);
  if (!out) throw new Error("--out attend le fichier de la tranche");
  const from = Number(option("--from", 0));
  const all = tasksOf(from, Number(option("--count", Infinity)));
  const kept = new Set(linesOf(out).map(keyOf));
  const tasks = all.filter((task) => !kept.has(keyOf(task.row)));
  console.log(`tranche ${from} : ${all.length} positions, déjà mesurées ${kept.size}, à faire ${tasks.length}`);
  const started = Date.now();
  progress("sure-lost-moves", kept.size, all.length, { unit: "position" });
  await runPool(new URL("../lib/workers/sure-lost-moves-worker.js", import.meta.url), tasks, {
    onResult: (result, k) => appendFileSync(out, `${JSON.stringify({ ...tasks[k].row, ...result })}\n`),
    onProgress: (done) => {
      progress("sure-lost-moves", kept.size + done, all.length, { unit: "position" });
      process.stderr.write(`position ${kept.size + done}/${all.length}, ${Math.round((Date.now() - started) / 1000)} s\n`);
    },
  });
  console.log(summary(linesOf(out)));
}

if (args.includes("--summary")) {
  const files = args.slice(args.indexOf("--summary") + 1).filter((arg) => !arg.startsWith("--"));
  const rows = files.flatMap(linesOf);
  const total = linesOf(tmpFile("sure-lost.jsonl")).filter(ruleCase).length;
  console.log(summary(rows));
  if (rows.length < total) {
    console.error(`il manque ${total - rows.length} positions sur ${total}`);
    process.exitCode = 1;
  }
} else {
  await slice();
}
