import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRng } from "../src/core/random.js";
import { runPool, workerCount } from "./lib/cli/pool.js";

/**
 * `npm run time-study`: does more thinking time make a better move? Positions
 * are drawn from the self-play games; on each, one search runs to the
 * reference budget and notes the move it would play at the budgets that
 * match 5, 10, 15, 20 and 30 s in the browser (`BROWSER_ROLLOUTS_PER_SECOND`,
 * measured). The reference's own ratings say what a different move costs.
 * The whole study stops after `MINUTES`.
 */
const BROWSER_ROLLOUTS_PER_SECOND = 164;
const SECONDS = [5, 10, 15, 20, 30];
const MINUTES = 15;
const POSITIONS = 160;
const checkpoints = SECONDS.map((s) => s * BROWSER_ROLLOUTS_PER_SECOND);
const reference = 2 * checkpoints.at(-1);

const logs = JSON.parse(await readFile(fileURLToPath(new URL("../selfplay/experimental_80.json", import.meta.url)), "utf8"));
const rng = createRng(2026);
const items = Array.from({ length: POSITIONS }, () => ({ log: logs[rng.int(logs.length)], turn: 3 + rng.int(33) }));
const threads = workerCount();
const started = Date.now();
const tasks = Array.from({ length: threads }, (_, t) => ({ items: items.filter((_, i) => i % threads === t), checkpoints, reference, seconds: MINUTES * 60 }));
const results = (await runPool(new URL("./lib/workers/time-study-worker.js", import.meta.url), tasks)).flat();

const pct = (x) => `${(100 * x).toFixed(1)} %`;
const lines = [`${results.length} positions, référence ${reference} simulations (${(reference / BROWSER_ROLLOUTS_PER_SECOND).toFixed(0)} s dans le navigateur), ${((Date.now() - started) / 60000).toFixed(1)} min`, ""];
lines.push("Temps   Même coup que la référence   Perte moyenne (points de victoire)   Arrêt anticipé");
SECONDS.forEach((seconds, i) => {
  const agree = results.filter((r) => r.picks[i].move === r.picks.at(-1).move).length / results.length;
  const loss = results.reduce((sum, r) => sum + Math.max(0, (r.ratings[r.picks.at(-1).move] ?? 0) - (r.ratings[r.picks[i].move] ?? r.ratings[r.picks.at(-1).move] ?? 0)), 0) / results.length;
  const early = results.filter((r) => r.picks[i].stoppedEarly).length / results.length;
  lines.push(`${String(seconds).padStart(3)} s   ${pct(agree).padStart(26)}   ${(100 * loss).toFixed(2).padStart(34)}   ${pct(early).padStart(14)}`);
});
process.stdout.write(`${lines.join("\n")}\n`);
