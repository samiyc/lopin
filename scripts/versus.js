import { readFile, writeFile } from "node:fs/promises";
import { PHASES, readGame, summarize } from "../src/replay/oracle/versus.js";
import { pairedInterval } from "./lib/domain/duel-plan.js";
import { loadGame, readIndex } from "./lib/domain/game-index.js";

/**
 * `npm run versus -- <engine A> <engine B> [--label stfig6] [--top 8]`: every
 * game A and B played against each other in duels/, pooled across files and
 * deck sets (src/replay/oracle/versus.js) — the score with its interval over the
 * deck pairs, the score by seat and by the jokers each got, and how A plays
 * differently, phase by phase, and ends the game with a different board.
 *
 * With `--label`, the summary (without the pairs) is kept in data/versus.json
 * under that name, for the docs and the notebook.
 *
 *   npm run versus -- "ismcts+widen=3+depth=5+core=stfig6@800" "ismcts+widen=3+depth=5@800" --label stfig6
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const [a, b] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
const label = option("--label", null);
const top = Number(option("--top", 8));
if (!a || !b) {
  process.stderr.write("Usage : npm run versus -- <moteur A> <moteur B> [--label nom] [--top 8]\n");
  process.exit(1);
}

const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;
const signed = (x) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1).replace(".", ",")}`;
const playedBy = (row, engine) => row.engines.includes(engine) || row.players.includes(engine);

const rows = (await readIndex()).filter((row) => playedBy(row, a) && playedBy(row, b) && a !== b);
const games = [];
for (const row of rows) {
  const game = readGame(await loadGame(row), a);
  if (game) games.push(game);
}
if (games.length === 0) {
  process.stderr.write(`Aucune partie de ${a} contre ${b} dans duels/.\n`);
  process.exit(1);
}
const summary = summarize(games);
const [low, high] = pairedInterval(summary.pairs);
const files = new Set(rows.map((row) => row.file)).size;

console.log(`${a}\n  contre ${b}\n`);
console.log(`  ${summary.games} parties dans ${files} fichier${files > 1 ? "s" : ""}, ${summary.pairs.length} donnes jouées des deux côtés`);
console.log(`  A marque ${pct(summary.score)} — fourchette à 95 % par paires : ${pct(low)} – ${pct(high)}`);
console.log(`  ${summary.turns.toFixed(1).replace(".", ",")} coups par partie en moyenne\n`);
for (const [title, groups] of [["Selon qui commence", summary.bySeat], ["Selon les jokers obtenus (A contre B)", summary.byJokers]]) {
  console.log(`  ${title} :`);
  for (const [key, group] of Object.entries(groups)) console.log(`    ${key.padEnd(14)} ${pct(group.score)}  (${group.games} parties)`);
}
console.log("\n  Ce que A joue autrement (part des coups ; A, B, écart en points) :");
for (const [phase] of PHASES) {
  console.log(`    ${phase}`);
  for (const t of summary.traits[phase].slice(0, top)) console.log(`      ${pct(t.a).padStart(7)} ${pct(t.b).padStart(7)} ${signed(t.a - t.b).padStart(6)}  ${t.trait}`);
}
const END_LABELS = { openedBy10: "bornes entamées au tour 10", complete: "côtés complets à la fin", noFigure: "dont sans figure", won: "bornes gagnées" };
console.log("\n  Le plateau de chaque camp (moyenne par partie ; A, B) :");
for (const [key, value] of Object.entries(summary.end)) console.log(`    ${value.a.toFixed(2).replace(".", ",").padStart(6)} ${value.b.toFixed(2).replace(".", ",").padStart(6)}  ${END_LABELS[key] ?? key}`);

if (label) {
  const path = new URL("../data/versus.json", import.meta.url);
  const kept = await readFile(path, "utf8").then(JSON.parse, () => ({ note: "npm run versus : deux moteurs comparés sur leurs parties gardées dans duels/.", duels: {} }));
  const { pairs, ...rest } = summary;
  kept.duels[label] = { a, b, built: new Date().toISOString().slice(0, 10), files, pairs: pairs.length, low, high, ...rest, traits: Object.fromEntries(Object.entries(rest.traits).map(([phase, list]) => [phase, list.slice(0, 12)])) };
  await writeFile(path, `${JSON.stringify(kept, null, 1)}\n`);
  console.log(`\n  → data/versus.json, « ${label} »`);
}
