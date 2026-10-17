import { readIndex, startTurn } from "./lib/domain/game-index.js";
import { runPool } from "./lib/cli/pool.js";

/**
 * `npm run core-test -- <engine> [--from 23] [--games 200] [--player experimental@0.9]`:
 * a quick test of a change of judgement, from a decisive turn (Sami, after the
 * retrospective). On kept games of the player against itself (duels/), from
 * turn `--from`, the engine takes one seat and the player keeps the other,
 * then the seats swap; the control plays the same positions with the player
 * on both seats, only its seed changed. Every line stops at turn 30, where the
 * exact solver says who holds the game.
 *
 * The score is the share of games the engine holds, over both seats, against
 * the control's share in the same positions — paired game by game, with its
 * 95 % interval. A change that only matters early in a game cannot show here:
 * confirm a winner with a whole-game duel (`npm run duel -- … --long --page`).
 *
 *   npm run core-test -- "ismcts+widen=3+depth=5+core=nb1@800"
 */
const args = process.argv.slice(2);
const option = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const flagValue = (i) => i > 0 && args[i - 1].startsWith("--");
const engine = args.find((arg, i) => !arg.startsWith("--") && !flagValue(i));
if (!engine) {
  process.stderr.write('Usage : npm run core-test -- "<moteur>" [--from 23] [--games 200]\n');
  process.exit(1);
}
const player = option("--player", "experimental@0.9");
const from = option("--from", "23");
const games = Number(option("--games", 200));
const started = Date.now();

const cases = (await readIndex())
  .filter((row) => row.players.every((name) => name === player))
  .map((row) => ({ row, turn: startTurn(row, from) }))
  .filter(({ row, turn }) => turn !== null && turn >= 1 && turn < row.turns)
  .slice(0, games);
// Per game: the engine in seat 0, in seat 1, and the control (the player on both seats, reseeded).
const tasks = cases.flatMap(({ row, turn }) => [
  { row, turn, engines: [engine, null] },
  { row, turn, engines: [null, engine] },
  { row, turn, reseed: 1 },
]);
const results = await runPool(new URL("./lib/workers/branch-worker.js", import.meta.url), tasks);

const holds = (holder, seat) => (holder === null ? 0.5 : Number(holder === seat));
const pairs = cases.map((_, i) => {
  const [first, second, control] = results.slice(3 * i, 3 * i + 3);
  const mine = (holds(first.holder, 0) + holds(second.holder, 1)) / 2;
  const base = (holds(control.holder, 0) + holds(control.holder, 1)) / 2;
  return { mine, base };
});
const mean = (values) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const diffs = pairs.map(({ mine, base }) => mine - base);
const avg = mean(diffs);
const sd = Math.sqrt(diffs.reduce((sum, d) => sum + (d - avg) ** 2, 0) / Math.max(1, diffs.length - 1));
const ci = (1.96 * sd) / Math.sqrt(Math.max(1, diffs.length));
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;
const points = (x) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1).replace(".", ",")}`;
function verdictOf() {
  if (avg - ci > 0) return "meilleur que le témoin";
  return avg + ci < 0 ? "moins bon que le témoin" : "pas de différence nette";
}
const verdict = verdictOf();
console.log(`${engine} contre ${player}, depuis ${from}, ${cases.length} parties × 2 sièges, ${((Date.now() - started) / 60000).toFixed(1)} min`);
console.log(`  tient la partie au tour 30 : ${pct(mean(pairs.map((p) => p.mine)))} ; le témoin, ${pct(mean(pairs.map((p) => p.base)))}`);
console.log(`  écart : ${points(avg)} points ± ${(100 * ci).toFixed(1).replace(".", ",")} → ${verdict}`);
