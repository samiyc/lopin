/**
 * Misjudged endgames (Sami, 19/10): in the kept duels since `--since`, the last two moves a tree searched before the
 * solver took over, searched again by `--engine` (the 1.2@2000 by default, duel logs keep visits, not rates). A
 * position is misjudged when the tree gives its mover over 60 % and they lose, or under 40 % and they win. Each one
 * carries what may explain it: the jokers' places, the rollout policy's win rate over random deals of the hidden
 * cards (`belief`) and on the true deal (`truth`).
 * `node scripts/archive/misjudged-endgames.js [--since 2026-10-15] [--engine E] [--limit N]`; `--summary` rereads
 * tmp/misjudged-endgames.json; `--solve N` solves N positions of each kind (overrated, underrated, rightly sure) over
 * the deals their mover cannot tell apart (misjudged-solve-worker.js); `--trace` follows the policy's games in the
 * overrated ones of that sample and keeps the move that hands the mover the win (misjudged-trace-worker.js).
 * Threads from `workerCount()`.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { runPool } from "../lib/cli/pool.js";
import { tmpFile } from "../lib/domain/tmp.js";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const ENGINE = option("--engine", "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000");
const SINCE = option("--since", "2026-10-15");
const LIMIT = Number(option("--limit", Infinity));
const DUELS = new URL("../../duels/", import.meta.url);
const OUT = tmpFile("misjudged-endgames.json");
const BAND = Object.freeze({ low: 0.4, high: 0.6 });

/** The turns a tree searched (they carry `tree`), the last two. */
const lastSearched = (game) => game.turns.filter((entry) => entry.tree).slice(-2).map((entry) => entry.turn);

/** A game light enough to post to a worker: what `stateAt` replays, nothing of the logged searches. */
const slim = (game) => ({ ...game, analysis: undefined, turns: game.turns.map((entry) => ({ ...entry, candidates: undefined, tree: undefined, lab: undefined })) });

function tasksOf() {
  const files = readdirSync(DUELS).filter((name) => name.endsWith(".json") && name !== "index.json" && name >= SINCE);
  const tasks = [];
  for (const file of files) {
    const duel = JSON.parse(readFileSync(new URL(file, DUELS), "utf8"));
    duel.games.forEach((game, index) => {
      const turns = lastSearched(game);
      if (turns.length > 0 && tasks.length < LIMIT) tasks.push({ file, game: index, engines: game.players.map((p) => p.bot), log: slim(game), turns, engine: ENGINE });
    });
  }
  return tasks;
}

const pc = (part, whole) => `${((100 * part) / Math.max(1, whole)).toFixed(1)} %`;
const mean = (rows, f) => rows.reduce((sum, row) => sum + f(row), 0) / Math.max(1, rows.length);
const over = (row) => row.rate > BAND.high && !row.won;
const under = (row) => row.rate < BAND.low && row.won;

/** The share of `rows` where `test` holds, among all and among misjudged. */
function line(label, rows, test) {
  const sure = rows.filter((row) => row.rate > BAND.high || row.rate < BAND.low);
  const wrong = sure.filter((row) => over(row) || under(row));
  return `  ${label.padEnd(44)} toutes ${pc(rows.filter(test).length, rows.length).padStart(7)} · hors 40-60 ${pc(sure.filter(test).length, sure.length).padStart(7)} · en erreur ${pc(wrong.filter(test).length, wrong.length).padStart(7)}`;
}

function byPile(rows) {
  const piles = [...new Set(rows.map((row) => row.pile))].sort((a, b) => a - b);
  return piles.map((pile) => {
    const at = rows.filter((row) => row.pile === pile);
    const sure = at.filter((row) => row.rate > BAND.high || row.rate < BAND.low);
    const wrong = sure.filter((row) => over(row) || under(row));
    return `  pioche ${String(pile).padStart(2)} : ${String(at.length).padStart(5)} positions, ${pc(sure.length, at.length)} hors 40-60, dont ${pc(wrong.length, sure.length)} démenties`;
  });
}

/** Misjudged positions split by what the true deal says: the policy sees the outcome there (luck), or not (its play). */
function causes(rows, label, test) {
  const wrong = rows.filter(test);
  const luck = wrong.filter((row) => (row.truth === 1) === row.won);
  return [
    `${label} : ${wrong.length} positions`,
    `  taux de l'arbre ${(100 * mean(wrong, (row) => row.rate)).toFixed(1)} % · simulations sur donnes tirées ${(100 * mean(wrong, (row) => row.belief)).toFixed(1)} %`,
    `  la vraie donne, jouée par la politique, donne le vrai résultat : ${pc(luck.length, wrong.length)} (la donne réelle était défavorable)`,
    `  la politique se trompe aussi sur la vraie donne : ${pc(wrong.length - luck.length, wrong.length)} (biais des simulations)`,
  ];
}

function summary(rows) {
  const decided = rows.filter((row) => row.decided);
  const sure = decided.filter((row) => row.rate > BAND.high || row.rate < BAND.low);
  return [
    `# Fins de partie mal jugées : ${decided.length} positions (${ENGINE}), les deux dernières recherches de chaque partie`,
    `hors 40-60 : ${sure.length} (${pc(sure.length, decided.length)}), démenties par le résultat : ${pc(sure.filter((row) => over(row) || under(row)).length, sure.length)}`,
    `  surestimées (> 60 %, perdues) ${decided.filter(over).length} · sous-estimées (< 40 %, gagnées) ${decided.filter(under).length}`,
    "",
    ...byPile(decided),
    "",
    "Les jokers (cartes réelles, pas ce que le joueur voit) :",
    line("le joueur à jouer en tient au moins un", decided, (row) => row.jokers.mine > 0),
    line("l'adversaire en tient au moins un", decided, (row) => row.jokers.theirs > 0),
    line("un joker dans la pioche", decided, (row) => row.jokers.pile > 0),
    line("aucun joker caché (adversaire ou pioche)", decided, (row) => row.jokers.theirs + row.jokers.pile === 0),
    "",
    ...causes(decided, "Surestimées", over),
    ...causes(decided, "Sous-estimées", under),
  ].join("\n");
}

/** Every k-th of `rows`, `n` at most: a sample spread over the duels. */
const spread = (rows, n) => rows.filter((_, k) => k % Math.max(1, Math.floor(rows.length / n)) === 0).slice(0, n);

function solveTasks(rows, n) {
  const right = (row) => (row.rate > BAND.high && row.won) || (row.rate < BAND.low && !row.won);
  const picked = [["surestimée", over], ["sous-estimée", under], ["juste", right]].flatMap(([kind, test]) => spread(rows.filter((row) => row.decided && test(row)), n).map((row) => ({ ...row, kind })));
  const games = new Map();
  for (const file of new Set(picked.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  return picked.map((row) => ({ row, log: slim(games.get(row.file)[row.game]), turn: row.turn }));
}

function solvedSummary(tasks, results) {
  const rows = tasks.map((task, k) => ({ ...task.row, ...results[k] }));
  const kinds = [...new Set(rows.map((row) => row.kind))];
  return kinds.map((kind) => {
    const at = rows.filter((row) => row.kind === kind && row.solved > 0);
    const far = at.filter((row) => Math.abs(row.exact - row.rate) > 0.2).length;
    return `${kind.padEnd(13)} ${String(at.length).padStart(4)} positions · arbre ${(100 * mean(at, (row) => row.rate)).toFixed(1)} % · simulations ${(100 * mean(at, (row) => row.belief)).toFixed(1)} % · solveur exact ${(100 * mean(at, (row) => row.exact)).toFixed(1)} % · arbre à plus de 20 points du solveur : ${pc(far, at.length)}`;
  }).join("\n");
}

async function solve(n) {
  const tasks = solveTasks(JSON.parse(readFileSync(OUT, "utf8")), n);
  console.log(`${tasks.length} positions à résoudre`);
  const started = Date.now();
  const results = await runPool(new URL("../lib/workers/misjudged-solve-worker.js", import.meta.url), tasks, {
    onProgress: (done) => done % 20 === 0 && console.log(`  ${done} / ${tasks.length}, ${Math.round((Date.now() - started) / 1000)} s`),
  });
  writeFileSync(tmpFile("misjudged-solved.json"), JSON.stringify(tasks.map((task, k) => ({ ...task.row, ...results[k] }))));
  console.log(solvedSummary(tasks, results));
}

const counted = (errors, test) => `${errors.filter(test).length} (${pc(errors.filter(test).length, errors.length)})`;

function traceSummary(errors) {
  const by = (actor) => errors.filter((error) => error.actor === actor);
  return [
    `${errors.length} simulations gagnées à tort (le solveur dit perdu)`,
    `  l'erreur est de l'adversaire : ${counted(errors, (e) => e.actor === "adversaire")} · du joueur lui-même : ${counted(errors, (e) => e.actor === "joueur")}`,
    `  le fautif tenait un joker : ${counted(errors, (e) => e.held > 0)} · il joue un joker : ${counted(errors, (e) => e.joker)} · le solveur aurait joué un joker : ${counted(errors, (e) => e.bestJoker)}`,
    `  le fautif pose sa 3e carte (complète un côté) : ${counted(errors, (e) => e.fills)}`,
    `  pioche au moment de l'erreur : ${[0, 1, 2].map((pile) => pile + " carte(s) " + counted(errors, (e) => e.pile === pile)).join(" · ")}`,
    `  adversaire fautif tenant un joker : ${counted(by("adversaire"), (e) => e.held > 0)} de ses erreurs`,
  ].join("\n");
}

async function trace() {
  const rows = JSON.parse(readFileSync(tmpFile("misjudged-solved.json"), "utf8")).filter((row) => row.kind === "surestimée");
  const games = new Map();
  for (const file of new Set(rows.map((row) => row.file))) games.set(file, JSON.parse(readFileSync(new URL(file, DUELS), "utf8")).games);
  const tasks = rows.map((row) => ({ log: slim(games.get(row.file)[row.game]), turn: row.turn }));
  console.log(`${tasks.length} positions surestimées à suivre`);
  const results = await runPool(new URL("../lib/workers/misjudged-trace-worker.js", import.meta.url), tasks, { onProgress: (done) => done % 10 === 0 && console.log(`  ${done} / ${tasks.length}`) });
  const all = results.flat();
  writeFileSync(tmpFile("misjudged-traced.json"), JSON.stringify(results));
  console.log(`sans erreur trouvée : ${all.filter((e) => e.none).length} · solveur à court : ${all.filter((e) => e.unsolved).length}`);
  console.log(traceSummary(all.filter((e) => e.actor)));
}

if (args.includes("--trace")) {
  await trace();
} else if (args.includes("--solve")) {
  await solve(Number(option("--solve", 60)));
} else if (args.includes("--summary")) {
  console.log(summary(JSON.parse(readFileSync(OUT, "utf8"))));
} else {
  const tasks = tasksOf();
  console.log(`${tasks.length} parties, ${tasks.reduce((sum, task) => sum + task.turns.length, 0)} positions`);
  const started = Date.now();
  const results = await runPool(new URL("../lib/workers/misjudged-worker.js", import.meta.url), tasks, {
    onProgress: (done) => done % 250 === 0 && console.log(`  ${done} / ${tasks.length} parties, ${Math.round((Date.now() - started) / 1000)} s`),
  });
  const rows = results.flatMap((positions, k) => positions.map((row) => ({ file: tasks[k].file, game: tasks[k].game, engines: tasks[k].engines, ...row })));
  writeFileSync(OUT, JSON.stringify(rows));
  console.log(summary(rows));
}
