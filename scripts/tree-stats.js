import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * `npm run tree-stats -- <duel files…> | --last N`: the shape of the tree bots' searches in kept duels, read from the
 * `tree` each of their moves carries (src/sim/mcts/tree-stats.js; Sami, 14/10). For each engine: the moves read, the mean
 * iterations, then by level the share of moves whose tree reaches it (a node with a visit there), the mean nodes,
 * the share of those at 0 and 1 visit, and the mean of the most visits — the numbers that choose a `pw` formula.
 *
 *   npm run tree-stats -- --last 3          the three newest duels in duels/
 */
const DUELS = fileURLToPath(new URL("../duels/", import.meta.url));
const args = process.argv.slice(2);

async function filesToRead() {
  if (!args.includes("--last")) return args;
  const count = Number(args[args.indexOf("--last") + 1]) || 1;
  const names = (await readdir(DUELS)).filter((name) => name.endsWith(".json") && name !== "index.json").sort();
  return names.slice(-count).map((name) => `${DUELS}${name}`);
}

/** A game's moves that carry a tree, each with the engine that searched it. */
const treesOf = (game) =>
  game.turns.filter((turn) => turn.tree).map((turn) => ({ engine: game.players.find((player) => player.seat === turn.player)?.bot ?? "?", tree: turn.tree }));

/** Each engine's moves that carry a tree, from every game of every file. */
async function treesByEngine(files) {
  const moves = [];
  for (const file of files) moves.push(...JSON.parse(await readFile(file, "utf8")).games.flatMap(treesOf));
  const byEngine = new Map();
  for (const { engine, tree } of moves) {
    const trees = byEngine.get(engine) ?? [];
    trees.push(tree);
    byEngine.set(engine, trees);
  }
  return byEngine;
}

const pct = (part, whole) => (whole ? `${((100 * part) / whole).toFixed(1)} %` : "—");
const mean = (sum, count) => (count ? (sum / count).toFixed(1) : "—");

/** The table of one engine: a line a level. */
function report(engine, trees) {
  const depth = Math.max(...trees.map((tree) => tree.levels.length));
  const iterations = trees.reduce((sum, tree) => sum + tree.iterations, 0);
  console.log(`\n${engine} — ${trees.length} coups, ${mean(iterations, trees.length)} itérations en moyenne`);
  console.log("niveau  atteint   nœuds moy.  0 visite   1 visite   max moy.");
  for (let d = 1; d <= depth; d += 1) {
    const levels = trees.map((tree) => tree.levels[d - 1]).filter(Boolean);
    const sum = (key) => levels.reduce((total, level) => total + level[key], 0);
    const reached = levels.filter((level) => level.max >= 1).length;
    const row = [String(d).padStart(6), pct(reached, trees.length).padStart(9), mean(sum("nodes"), levels.length).padStart(11), pct(sum("zero"), sum("nodes")).padStart(10), pct(sum("one"), sum("nodes")).padStart(10), mean(sum("max"), levels.length).padStart(10)];
    console.log(row.join(" "));
  }
}

const files = await filesToRead();
const byEngine = await treesByEngine(files);
if (byEngine.size === 0) console.log(`Aucun coup avec ses statistiques d'arbre dans ${files.length} fichier(s) : des duels antérieurs au 14/10 ?`);
for (const [engine, trees] of byEngine) report(engine, trees);
