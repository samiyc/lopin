/**
 * The « sure » endgames lost (Sami, 28/10, docs/priorites-1.3.md § 14): the positions of tmp/misjudged-endgames.json
 * the 1.2@2000 rated 95 % or more and lost, those it rated 5 % or less and won, and as many rightly sure ones as
 * controls, read under both end rules (sure-lost-worker.js). The game plays `claim-end`, every search deal `final`:
 * does the gap between the rules explain the lost certainties?
 * `node scripts/archive/sure-lost.js [--controls N] [--nodes N] [--threads N] [--fresh]`; `--summary` rereads
 * tmp/sure-lost.jsonl. As mcts-commun asks of long jobs (docs/backlog.md, « Recommandations aux projets »; Sami, 28/10:
 * the first run kept its results for its end, an hour on): each position is appended to the file as it lands, its
 * progress traced for the queue's views and told on stderr, and a run stopped midway starts again where it was
 * (`--fresh` starts over).
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { progress } from "mcts-commun/trace.js";
import { applyThreadsOption, runPool } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const args = process.argv.slice(2);
applyThreadsOption(args);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const CONTROLS = Number(option("--controls", 120));
const DUELS = new URL("../../duels/", import.meta.url);
// The solver's cap per deal: 1.5 M nodes (~600 MB a thread) as the 19/10 solves; 400 000 (EXACT.nodes) spares memory.
const NODES = Number(option("--nodes", 1_500_000));
const OUT = tmpFile("sure-lost.jsonl");
const SURE = Object.freeze({ low: 0.05, high: 0.95 });

/** What `stateAt` replays, nothing of the logged searches. */
const slim = (game) => ({ ...game, analysis: undefined, turns: game.turns.map((entry) => ({ ...entry, candidates: undefined, tree: undefined, lab: undefined })) });

/** Every k-th of `rows`, `n` at most: a sample spread over the duels. */
const spread = (rows, n) => rows.filter((_, k) => k % Math.max(1, Math.floor(rows.length / n)) === 0).slice(0, n);

/** The mover's side of a sure position: `ahead` when the tree gave them 95 %+, `behind` at 5 % or less. */
function picked(rows) {
  const decided = rows.filter((row) => row.decided);
  const ahead = (row) => row.rate >= SURE.high;
  const behind = (row) => row.rate <= SURE.low;
  return [
    ...decided.filter((row) => ahead(row) && !row.won).map((row) => ({ ...row, kind: "sûre perdue", side: "ahead" })),
    ...decided.filter((row) => behind(row) && row.won).map((row) => ({ ...row, kind: "perdue gagnée", side: "behind" })),
    ...spread(decided.filter((row) => ahead(row) && row.won), CONTROLS).map((row) => ({ ...row, kind: "sûre gagnée", side: "ahead" })),
  ];
}

function tasksOf() {
  const rows = picked(JSON.parse(readFileSync(tmpFile("misjudged-endgames.json"), "utf8")));
  const games = new Map();
  for (const file of new Set(rows.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  return rows.map((row) => ({ row, log: slim(games.get(row.file)[row.game]), turn: row.turn, nodes: NODES }));
}

/** A position's key: its duel, game and turn. */
const keyOf = (row) => `${row.file}#${row.game}#${row.turn}`;

/** The lines of the results file that parse (the last one cut, its run stopped while writing it, is left out). */
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

const pc = (x) => (x === null || Number.isNaN(x) ? "  —  " : `${(100 * x).toFixed(1).padStart(5)} %`);
const mean = (rows, f) => {
  const values = rows.map(f).filter((value) => value !== null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};
const share = (rows, test) => rows.filter(test).length / Math.max(1, rows.length);

/** The mover's chances as the side the tree was sure of: a win share for `ahead`, a loss share for `behind`. */
function sureOf(row, value) {
  if (value === null) return null;
  return row.side === "ahead" ? value : 1 - value;
}
const won = (value) => (value === null ? null : Number(value > 0));

/**
 * Why a sure position went the other way, from the exact solves: `règle` when the deals are won under `final` and
 * not under `claim-end` (the rules' gap), `position` when both rules lose them (the tree misread the position:
 * jokers, rollouts, § 7), `donne` when both win them but the true deal does not (bad luck), `suite` when the true
 * deal was won and still lost (a later move).
 */
function causeOf(row) {
  const claim = sureOf(row, row.exact["claim-end"]);
  const final = sureOf(row, row.exact.final);
  if (claim === null || final === null) return "non résolue";
  if (final >= 0.75 && claim < 0.75 && final - claim >= 0.25) return "règle";
  if (claim < 0.75) return "position";
  return sureOf(row, won(row.truth["claim-end"])) === 1 ? "suite" : "donne";
}

const CAUSES = Object.freeze(["règle", "position", "donne", "suite", "non résolue"]);

function table(rows) {
  const kinds = [...new Set(rows.map((row) => row.kind))];
  const line = (kind, at) => [
    `${kind.padEnd(14)} ${String(at.length).padStart(4)}`,
    `arbre ${pc(mean(at, (row) => sureOf(row, row.rate)))}`,
    `politique final ${pc(mean(at, (row) => sureOf(row, row.policy.final)))} claim-end ${pc(mean(at, (row) => sureOf(row, row.policy["claim-end"])))}`,
    `solveur final ${pc(mean(at, (row) => sureOf(row, row.exact.final)))} claim-end ${pc(mean(at, (row) => sureOf(row, row.exact["claim-end"])))}`,
    `vraie donne final ${pc(mean(at, (row) => sureOf(row, won(row.truth.final))))} claim-end ${pc(mean(at, (row) => sureOf(row, won(row.truth["claim-end"]))))}`,
  ].join(" · ");
  const causeShare = (at, cause) => `${cause} ${pc(share(at, (row) => causeOf(row) === cause)).trim()}`;
  const causes = (kind, at) => " ".repeat(19) + CAUSES.map((cause) => causeShare(at, cause)).join(" · ");
  return [
    "Ce que chacun donne au camp dont l'arbre était sûr (moyennes ; « vraie donne » : le solveur sur la donne réelle) :",
    ...kinds.flatMap((kind) => {
      const at = rows.filter((row) => row.kind === kind);
      return [line(kind, at), causes(kind, at)];
    }),
  ].join("\n");
}

/** The positions where the rules disagree on the true deal, by how the game really ended. */
function disagreements(rows) {
  const split = rows.filter((row) => row.truth.final !== null && row.truth["claim-end"] !== null && won(row.truth.final) !== won(row.truth["claim-end"]));
  const byEnd = Object.groupBy(split, (row) => `${row.kind}, fin par ${row.end.winType}`);
  return [
    `La donne réelle change de vainqueur selon la règle dans ${split.length} positions sur ${rows.length} :`,
    ...Object.entries(byEnd).map(([label, at]) => `  ${label} : ${at.length}`),
  ].join("\n");
}

const summary = (rows) => [table(rows), "", disagreements(rows)].join("\n");

async function run() {
  if (args.includes("--fresh")) writeFileSync(OUT, "");
  const kept = new Set(linesOf(OUT).map(keyOf));
  const all = tasksOf();
  const tasks = all.filter((task) => !kept.has(keyOf(task.row)));
  const kinds = Object.entries(Object.groupBy(all, (task) => task.row.kind)).map(([kind, at]) => `${kind} ${at.length}`);
  console.log(`${all.length} positions : ${kinds.join(", ")} ; déjà mesurées ${kept.size}, à faire ${tasks.length}`);
  const started = Date.now();
  // Said from the start: a position at two pile cards takes minutes.
  progress("sure-lost", kept.size, all.length, { unit: "position" });
  await runPool(new URL("../lib/workers/sure-lost-worker.js", import.meta.url), tasks, {
    onResult: (result, k) => appendFileSync(OUT, `${JSON.stringify({ ...tasks[k].row, ...result })}\n`),
    onProgress: (done) => {
      progress("sure-lost", kept.size + done, all.length, { unit: "position" });
      process.stderr.write(`position ${kept.size + done}/${all.length}, ${Math.round((Date.now() - started) / 1000)} s\n`);
    },
  });
  console.log(summary(linesOf(OUT)));
}

if (args.includes("--summary")) console.log(summary(linesOf(OUT)));
else await run();
