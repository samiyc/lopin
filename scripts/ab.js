import { BOT_LINEUP, engineOf } from "../src/config/bots.js";
import { OFFICIAL_RULES } from "../src/config/rules.js";
import { DUEL_ROW, SEED } from "../src/config/simulations.js";
import { wilson } from "../src/irl/analysis.js";
import { engineFor } from "../src/sim/bots.js";
import { pointsOf } from "./lib/domain/duel-plan.js";
import { runPool } from "./lib/cli/pool.js";

/**
 * `npm run ab -- <reference> <variant>… [--vs stratege] [--pairs 200] [--page] [--offset K]`:
 * every engine against the same opponent, on the same decks from both seats.
 * Prints each engine's score against the opponent, then each variant's
 * difference with the reference, deck pair by deck pair — the decks are
 * shared, so their luck cancels out of the difference.
 *
 * Against the Stratège, a game costs one searching side instead of two, so
 * several variants and their reference come out cheaper than as many duels
 * with the reference. But a difference of two scores against a third bot is
 * smaller than the same gap head to head: a candidate still ends with a
 * direct duel (`npm run duel`).
 */
const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const valued = new Set(["--vs", "--pairs", "--offset"]);
const engines = args.filter((arg, i) => !arg.startsWith("--") && !valued.has(args[i - 1]));
const opponentId = flag("--vs", "stratege");
const opponent = opponentId in BOT_LINEUP ? engineOf(opponentId) : opponentId;
const pairs = Number(flag("--pairs", 200));
const base = SEED + 1_000_003 * Number(flag("--offset", 0));
const endMode = args.includes("--page") ? OFFICIAL_RULES.endMode : "early";
const CHUNK = 2;
const chunks = Math.ceil(pairs / CHUNK);
if (engines.length === 0) throw new Error("Usage : npm run ab -- <référence> <variante>… [--vs stratege] [--pairs 200] [--page]");
engines.forEach((id) => engineFor(id));
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")}`;

/** Chunk by chunk, every engine from both seats: an interrupted run stays balanced. */
function tasksOf() {
  const tasks = [];
  for (let t = 0; t < chunks; t += 1) {
    const games = Math.min(CHUNK, pairs - t * CHUNK);
    engines.forEach((id, e) =>
      [0, 1].forEach((seat) => {
        const players = seat === 0 ? [id, opponent] : [opponent, id];
        tasks.push({ ...DUEL_ROW, endMode, keepWinners: true, players, labels: players, games, seed: base + 104729 * (2 * t + seat), deals: base + 7 * 104729 * t, engine: e, seat, chunk: t });
      }),
    );
  }
  return tasks;
}

/** Each engine's pair scores (0, ½ or 1), deck by deck in the same order. */
function pairScores(tasks, results) {
  const scores = engines.map(() => []);
  for (let i = 0; i < tasks.length; i += 2) {
    const [first, second] = [results[i].winners, results[i + 1].winners];
    first.forEach((winner, g) => scores[tasks[i].engine].push((pointsOf(winner, 0) + pointsOf(second[g], 1)) / 2));
  }
  return scores;
}

/** Mean of the deck-by-deck differences, and the half-width of its 95 % interval. */
function meanAndHalf(values) {
  const mean = values.reduce((sum, x) => sum + x, 0) / values.length;
  const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return { mean, half: 1.96 * Math.sqrt(variance / values.length) };
}

const started = Date.now();
const tasks = tasksOf();
let shown = 0;
const results = await runPool(new URL("./lib/workers/sim-worker.js", import.meta.url), tasks, {
  onProgress: (done, total) => {
    if (done / total < shown + 0.1) return;
    shown = Math.floor((10 * done) / total) / 10;
    process.stderr.write(`  ${Math.round(100 * shown)} %, ${((Date.now() - started) / 60000).toFixed(1)} min\n`);
  },
});
const scores = pairScores(tasks, results);
const minutes = ((Date.now() - started) / 60000).toFixed(1);
console.log(`Contre ${opponentId}, ${pairs} donnes jouées des deux sièges, règle ${endMode}, ${minutes} min`);
engines.forEach((id, e) => {
  const mean = scores[e].reduce((sum, x) => sum + x, 0) / pairs;
  const [low, high] = wilson(Math.round(2 * pairs * mean), 2 * pairs);
  const line = `  ${pct(mean)} % (${pct(low)} – ${pct(high)})  ${id}`;
  if (e === 0) return console.log(`${line}  [référence]`);
  const { mean: gap, half } = meanAndHalf(scores[e].map((x, i) => x - scores[0][i]));
  console.log(`${line}  écart ${pct(gap)} ± ${pct(half)} pts`);
});
