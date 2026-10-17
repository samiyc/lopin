import { readFile, writeFile } from "node:fs/promises";
import { V1_ENGINE } from "../src/config/bots.js";
import { ORACLE } from "../src/replay/oracle/oracle.js";
import { summarizeShadow } from "../src/replay/oracle/shadow.js";
import { readIndex } from "./lib/domain/game-index.js";
import { runPool } from "./lib/cli/pool.js";

/**
 * `npm run shadow -- [<oracle engine>] [--engine <bot engine>] [--minutes N]`:
 * the games the oracle played, read again by the V1 (Sami, 03/10;
 * src/replay/oracle/shadow.js). At each of the oracle's moves: does the V1's search
 * play it, is it in its core's top 1 / 3 / 8, and how much of the oracle's
 * visits the V1's move got — by group of turns, with the clearest
 * disagreements, which `npm run oracle -- --confirm` can then play out.
 * Summary in data/oracle-shadow.json, under the bot read.
 *
 *   npm run shadow
 *   npm run shadow -- "ismcts+candidates=99+widen=6+depth=5+smart=1@20000" --engine "ismcts+widen=3+depth=5@800"
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const oracle = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? `${ORACLE.engine}@${ORACLE.budget}`;
const engine = option("--engine", V1_ENGINE);
const minutes = Number(option("--minutes", Infinity));
const ROOT = new URL("../", import.meta.url);
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;

// Every game the oracle played, whoever it played against; against itself, both seats are read.
const rows = (await readIndex()).filter((row) => row.engines.includes(oracle) || row.players.includes(oracle));
if (rows.length === 0) {
  process.stderr.write(`Aucune partie de ${oracle} dans duels/.\n`);
  process.exit(1);
}
console.log(`${rows.length} parties de l'oracle, relues par ${engine}`);
const started = Date.now();
const results = await runPool(new URL("./lib/workers/shadow-worker.js", import.meta.url), rows.map((row) => ({ row: { key: row.key, file: row.file, game: row.game }, oracle, engine })), {
  shouldStop: () => Date.now() - started > minutes * 60_000,
});
const summary = summarizeShadow(results.filter(Boolean).flat());
if (summary.all.moves === 0) {
  process.stderr.write("Aucun coup de l'oracle avec ses candidats : ces parties ont été jouées avant qu'un replay les garde.\n");
  process.exit(1);
}

console.log(`${summary.all.moves} coups de l'oracle : le V1 joue le même ${pct(summary.all.agrees)}, il est dans le top 8 de son cœur ${pct(summary.all.core8)}`);
console.log("  tours     coups   même coup  top 1   top 3   top 8   visites perdues");
for (const g of summary.groups) {
  const cells = [g.agrees, g.core1, g.core3, g.core8, g.lost].map((x) => pct(x).padStart(7));
  console.log(`  ${g.turns.padEnd(8)} ${String(g.moves).padStart(5)}   ${cells.join(" ")}`);
}
console.log("Les désaccords les plus nets (part des visites de l'oracle que perd le coup du V1) :");
for (const row of summary.clearest.slice(0, 8)) console.log(`  ${row.key} tour ${row.turn} : oracle ${row.move}, V1 ${row.searched} (−${pct(row.lost)})`);

const path = new URL("data/oracle-shadow.json", ROOT);
const kept = await readFile(path, "utf8").then(JSON.parse, () => ({ note: "npm run shadow : les parties de l'oracle relues par un autre robot.", reads: {} }));
kept.reads[engine] = { built: new Date().toISOString().slice(0, 10), oracle, oracleVersion: ORACLE.version, games: rows.length, ...summary };
await writeFile(path, `${JSON.stringify(kept, null, 1)}\n`);
