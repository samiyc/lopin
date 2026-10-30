/**
 * ClaimPile2 (Sami, 30/10, docs/priorites-1.3.md § 16): the « sure » endgames searched again by the 1.2, the 1.2 with
 * `+claimPile=2` (the iterations at the game's rule once the pile holds 2 cards or fewer, deal.js), EndPimc3
 * (`+pimc=3`) and both, 3 seeds each, at 2 000 iterations. On the positions lost to the rules' gap
 * (sure-lost-moves.js solved their every move), does the variant pick a move that wins more deals at `claim-end`? On
 * the sure positions won with 1-2 cards in the pile (the controls), does it break any? And what does a move cost?
 * A queue job (mcts-commun docs/backlog.md): `--from K --count N --out F` measures a slice, each position appended to F
 * as it lands, its progress traced, a slice started again keeping what F holds; `--summary F…` makes the table.
 *   node scripts/archive/claim-pile.js --from 0 --count 51 --out tmp/claim-pile-a.jsonl
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { progress } from "mcts-commun/trace.js";
import { applyThreadsOption, runPool } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const args = process.argv.slice(2);
applyThreadsOption(args);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const DUELS = new URL("../../duels/", import.meta.url);
const NODES = 400_000;
const SEEDS = Number(option("--seeds", 3));
const BASE = "ismcts+widen=7+depth=5+core=stfig6+exact=12";
const ENGINES = Object.freeze({
  "1.2": `${BASE}@2000`,
  ClaimPile2: `${BASE}+claimPile=2@2000`,
  EndPimc3: `${BASE}+pimc=3@2000`,
  "ClaimPile2+EndPimc3": `${BASE}+claimPile=2+pimc=3@2000`,
});

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

/** The positions: the rules' gap first (their moves' shares from sure-lost-moves), then the controls. */
function positions() {
  const solved = new Map(["a", "b"].flatMap((part) => linesOf(tmpFile(`sure-lost-moves-${part}.jsonl`))).map((row) => [keyOf(row), row]));
  const known = (row) => Object.fromEntries((solved.get(keyOf(row))?.moves ?? []).filter((m) => m.share !== null).map((m) => [`${m.card} ${m.border}`, m.share]));
  const rows = linesOf(tmpFile("sure-lost.jsonl"));
  return [
    ...rows.filter(ruleCase).map((row) => ({ row: { ...row, group: "règle" }, known: known(row) })),
    ...rows.filter((row) => row.kind === "sûre gagnée" && row.pile <= 2).map((row) => ({ row: { ...row, group: "témoin" }, known: {} })),
  ];
}

const slim = (game) => ({ ...game, analysis: undefined, turns: game.turns.map((entry) => ({ ...entry, candidates: undefined, tree: undefined, lab: undefined })) });

function tasksOf(from, count) {
  const chosen = positions().slice(from, from + count);
  const games = new Map();
  for (const file of new Set(chosen.map(({ row }) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  return chosen.map(({ row, known }) => ({ row, log: slim(games.get(row.file)[row.game]), turn: row.turn, nodes: NODES, engines: ENGINES, seeds: SEEDS, known }));
}

const mean = (list) => list.reduce((sum, x) => sum + x, 0) / Math.max(1, list.length);
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0;
const pc = (share) => `${(100 * share).toFixed(1)} %`;

/** An engine's mean share at `claim-end` over its seeds' moves, null when a move was not solved. */
function shareOf(row, label) {
  const shares = row.picks[label].map(({ move }) => row.shares[move]);
  return shares.some((share) => share === null || share === undefined) ? null : mean(shares);
}

function groupLine(rows, label) {
  const read = rows.filter((row) => shareOf(row, "1.2") !== null && shareOf(row, label) !== null);
  const gaps = read.map((row) => shareOf(row, label) - shareOf(row, "1.2"));
  const better = gaps.filter((gap) => gap > 0.01).length;
  const worse = gaps.filter((gap) => gap < -0.01).length;
  const broken = gaps.filter((gap) => gap <= -0.25).length;
  return `${pc(mean(read.map((row) => shareOf(row, label))))} des donnes (${read.length} positions), mieux ${better} · moins bien ${worse} (dont ${broken} de 25 points ou plus)`;
}

function costLine(rows, label) {
  const ms = (pile) => rows.filter((row) => pile(row.pile)).flatMap((row) => row.picks[label].map((pick) => pick.ms));
  const base = (pile) => rows.filter((row) => pile(row.pile)).flatMap((row) => row.picks["1.2"].map((pick) => pick.ms));
  const ratio = (pile) => (ms(pile).length === 0 ? "—" : `${median(ms(pile))} ms (×${(mean(ms(pile)) / Math.max(1, mean(base(pile)))).toFixed(2)})`);
  return `pioche 1 ${ratio((p) => p === 1)} · pioche 2 ${ratio((p) => p === 2)} · 3+ ${ratio((p) => p >= 3)}`;
}

function summary(rows) {
  const lines = [];
  for (const group of ["règle", "témoin"]) {
    const kept = rows.filter((row) => row.row.group === group);
    lines.push(`${group} (${kept.length} positions) : part des donnes gagnées à claim-end par le coup choisi, contre la 1.2`);
    for (const label of Object.keys(ENGINES)) lines.push(`  ${label.padEnd(20)} ${groupLine(kept, label)}`);
  }
  lines.push("temps d'un coup, médian (et moyenne contre la 1.2)");
  for (const label of Object.keys(ENGINES)) lines.push(`  ${label.padEnd(20)} ${costLine(rows.map((row) => ({ ...row, pile: row.row.pile })), label)}`);
  return lines.join("\n");
}

async function slice() {
  const out = option("--out", null);
  if (!out) throw new Error("--out attend le fichier de la tranche");
  const from = Number(option("--from", 0));
  const all = tasksOf(from, Number(option("--count", Infinity)));
  const kept = new Set(linesOf(out).map((line) => keyOf(line.row)));
  const tasks = all.filter((task) => !kept.has(keyOf(task.row)));
  console.log(`tranche ${from} : ${all.length} positions, déjà mesurées ${kept.size}, à faire ${tasks.length}`);
  const started = Date.now();
  progress("claim-pile", kept.size, all.length, { unit: "position" });
  await runPool(new URL("../lib/workers/claim-pile-worker.js", import.meta.url), tasks, {
    onResult: (result, k) => appendFileSync(out, `${JSON.stringify({ row: tasks[k].row, ...result })}\n`),
    onProgress: (done) => {
      progress("claim-pile", kept.size + done, all.length, { unit: "position" });
      process.stderr.write(`position ${kept.size + done}/${all.length}, ${Math.round((Date.now() - started) / 1000)} s\n`);
    },
  });
  console.log(summary(linesOf(out)));
}

if (args.includes("--summary")) {
  const files = args.slice(args.indexOf("--summary") + 1).filter((arg) => !arg.startsWith("--"));
  const rows = files.flatMap(linesOf);
  const total = positions().length;
  console.log(summary(rows));
  if (rows.length < total) {
    console.error(`il manque ${total - rows.length} positions sur ${total}`);
    process.exitCode = 1;
  }
} else {
  await slice();
}
