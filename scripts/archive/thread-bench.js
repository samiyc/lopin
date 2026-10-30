import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCommand } from "../lib/cli/run-command.js";
import { watchMemory } from "mcts-commun/machine.js";
import { appendJobLog, jobLine } from "../lib/domain/job-log.js";
import { tmpFile } from "../lib/domain/tmp.js";

/**
 * Step 3 of the scheduler (Sami, 22/10, docs/ismcts-ailleurs/backlog.md § 8): how many threads should a
 * duel take? The same duel of the 1.2 against itself at 400 iterations — same decks, same seeds, so the
 * same work — alone at 18, 12, 9 and 6 threads, then two at once, 12 + 6 and 9 + 9. Each run goes to the
 * job log (source "bench"); its games, kept in tmp/thread-bench/<run>/ (--save with LOPIN_DUELS_DIR: duels/
 * keeps a game once, and every run replays the same decks), give the threads really occupied, the
 * mean seconds a game (slower when two threads share a core) and the steady rate between 10 % and 90 % of
 * the games (no start, no tail). Summary in tmp/thread-bench.json, rewritten after each step.
 *
 *   node scripts/archive/thread-bench.js [--games 125] [--only 18,6]
 */
const ENGINE = "ismcts+widen=7+depth=5+core=stfig6+exact=12@400";
const args = process.argv.slice(2);
const games = args.includes("--games") ? Number(args[args.indexOf("--games") + 1]) : 125;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map(Number) : null;
const STEPS = [[18], [12], [9], [6], [12, 6], [9, 9]].filter((step) => !only || step.every((threads) => only.includes(threads)));
const COMMAND = `npm run duel -- "${ENGINE}" "${ENGINE}" --games ${games} --page --offset 0 --save`;
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** One duel run at `threads`, logged; resolves with its label, start and end. */
async function runDuel(threads, label) {
  const outFile = tmpFile(`thread-bench-${label}.txt`);
  const folder = tmpFile(`thread-bench/${label}/`);
  rmSync(folder, { recursive: true, force: true });
  const memory = watchMemory();
  const started = new Date();
  const code = await runCommand(COMMAND, { outFile, env: { LOPIN_THREADS: String(threads), LOPIN_DUELS_DIR: fileURLToPath(folder) }, quiet: true });
  const ended = new Date();
  const status = code === 0 ? "done" : "failed";
  const output = readFileSync(outFile, "utf8");
  const line = jobLine({ id: `THREAD_BENCH_${label}`, command: COMMAND, threads, started, ended, status, output, memory: memory.stop(), source: "bench" });
  await appendJobLog(line);
  const file = readdirSync(folder).find((name) => name.endsWith(".json") && name !== "index.json");
  return { label, threads, status, spans: file ? gamesIn(new URL(file, folder)) : null };
}

/** A kept duel's games as [start, end] in ms, sorted by end. */
function gamesIn(url) {
  const duel = JSON.parse(readFileSync(url, "utf8"));
  return duel.games.map((game) => [Date.parse(game.startedAt), Date.parse(game.endedAt)]).sort((a, b) => a[1] - b[1]);
}

/** What a duel's games say: threads occupied, seconds a game, games an hour overall and in the steady part. */
function statsOf(spans) {
  const busy = spans.reduce((sum, [start, end]) => sum + end - start, 0);
  const wall = spans.at(-1)[1] - Math.min(...spans.map(([start]) => start));
  const at = (share) => spans[Math.floor(share * (spans.length - 1))][1];
  const steady = (0.8 * spans.length) / ((at(0.9) - at(0.1)) / 3_600_000);
  return { games: spans.length, minutes: round(wall / 60_000, 2), occupied: round(busy / wall), secondsPerGame: round(busy / spans.length / 1000), perHour: round((spans.length * 3_600_000) / wall), steadyPerHour: round(steady) };
}

/** Games of every duel ended while all of them ran, an hour: the combined rate of jobs side by side. */
function overlapRate(allSpans) {
  const from = Math.max(...allSpans.map((spans) => Math.min(...spans.map(([start]) => start))));
  const to = Math.min(...allSpans.map((spans) => spans.at(-1)[1]));
  const ended = allSpans.flat().filter(([, end]) => end > from && end <= to).length;
  return to > from ? round((ended * 3_600_000) / (to - from)) : null;
}

/** Runs one step (one duel, or several at once) and reads their games back. */
async function runStep(step) {
  const labelOf = (i) => step.join("+") + (step.length > 1 ? "_" + (i + 1) : "");
  const runs = await Promise.all(step.map((threads, i) => runDuel(threads, labelOf(i))));
  const duels = runs.map(({ spans, ...run }) => ({ ...run, ...(spans ? statsOf(spans) : {}) }));
  const spans = runs.map((run) => run.spans).filter(Boolean);
  return { step: step.join(" + "), duels, together: step.length > 1 && spans.length === step.length ? overlapRate(spans) : null };
}

const results = [];
for (const step of STEPS) {
  const result = await runStep(step);
  results.push(result);
  writeFileSync(tmpFile("thread-bench.json"), `${JSON.stringify({ engine: ENGINE, games: 2 * games, results }, null, 1)}\n`);
  for (const duel of result.duels) {
    console.log(`${result.step.padEnd(7)} ${String(duel.threads).padStart(2)} fils : ${duel.minutes} min, ${duel.occupied} fils occupés, ${duel.secondsPerGame} s par partie, ${duel.perHour} parties/h (${duel.steadyPerHour} en régime)`);
  }
  if (result.together) console.log(`        ensemble : ${result.together} parties/h pendant qu'ils tournent tous`);
}
