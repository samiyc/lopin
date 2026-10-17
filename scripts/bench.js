import { createRng } from "../src/core/random.js";
import { engineFor } from "../src/sim/bots.js";
import { solveEndgame } from "../src/sim/eval/endgame.js";
import { legalMoves } from "../src/sim/engine/game.js";
import { hardestPuzzles, midGames, moveText } from "./lib/domain/bench-positions.js";

/**
 * `npm run bench [-- budget seeds engine]`: the yardstick of the experimental
 * search, next to `npm run fingerprint`.
 *
 * - On the 20 hardest puzzles: does the search find a winning move (the
 *   solver knows them), with how many rollouts and milliseconds; and does
 *   the bot itself, which solves endgames of 8 cards or fewer exactly.
 * - On 12 mid-game positions: rollouts per second, where rollouts are long.
 *
 * Each position is searched with several seeds, one after the other on one
 * thread, and the medians are printed: the PC's noise is smoothed, and an
 * optimisation shows as a lower time for the same answers.
 */
const [budgetArg, seedArg, engineId = "experimental"] = process.argv.slice(2);
const [budget, seedCount] = [Number(budgetArg) || 400, Number(seedArg) || 3];
const seeds = Array.from({ length: seedCount }, (_, i) => i + 1);

function searchOnce(state, seed) {
  const bot = engineFor(engineId)(createRng(seed));
  const started = performance.now();
  const search = bot.searchFor(state, legalMoves(state), {});
  while (!search.done() && search.rollouts() < budget) search.step();
  return { move: search.best(), rollouts: search.rollouts(), ms: performance.now() - started };
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function measure(position) {
  const runs = seeds.map((seed) => searchOnce(position.state, seed));
  const found = position.solutions ? runs.filter((run) => position.solutions.has(moveText(position.state, run.move))).length : null;
  const rollouts = runs.reduce((sum, run) => sum + run.rollouts, 0);
  const ms = runs.reduce((sum, run) => sum + run.ms, 0);
  const moves = runs.map((run) => moveText(position.state, run.move));
  return { id: position.id, found, moves, rollouts: median(runs.map((run) => run.rollouts)), ms: median(runs.map((run) => run.ms)), perSecond: (1000 * rollouts) / ms };
}

/** What the bot itself plays (0.7: the exact solver once the endgame is small enough): right or wrong, and how fast. */
function botChoice(position) {
  const started = performance.now();
  const move = engineFor(engineId)(createRng(1)).choose(position.state, legalMoves(position.state));
  const ms = performance.now() - started;
  return { right: position.solutions.has(moveText(position.state, move)), ms };
}

function solverMs(position) {
  const started = performance.now();
  solveEndgame(position.state);
  return performance.now() - started;
}

const line = (cells) => `| ${cells.join(" | ")} |`;

function report(title, rows, extra = () => []) {
  console.log(`\n## ${title}\n`);
  const found = rows[0]?.found !== null;
  console.log(line(["Position", ...(found ? ["Trouvé"] : []), "Simulations", "ms", "Simul./s", ...extra(null)]));
  console.log(line(Array(4 + Number(found) + extra(null).length).fill("---")));
  for (const row of rows) console.log(line([row.id, ...(found ? [`${row.found}/${seeds.length}`] : []), row.rollouts, row.ms.toFixed(0), row.perSecond.toFixed(0), ...extra(row)]));
  const total = rows.reduce((sum, row) => sum + row.rollouts / row.perSecond, 0);
  const perSecond = rows.reduce((sum, row) => sum + row.rollouts, 0) / total;
  const hits = found ? `, coup gagnant trouvé ${rows.reduce((sum, row) => sum + row.found, 0)} / ${rows.length * seeds.length}` : "";
  console.log(`\nMédiane ${median(rows.map((row) => row.ms)).toFixed(0)} ms par recherche, ${perSecond.toFixed(0)} simulations/s${hits}.`);
}

const started = performance.now();
console.log(`# Banc d'essai — ${engineId}, budget ${budget} simulations, ${seeds.length} graines`);
const puzzles = await hardestPuzzles(20);
const puzzleRows = puzzles.map((position) => ({ ...measure(position), solver: solverMs(position), bot: botChoice(position) }));
const botCells = (row) => (row ? [row.solver.toFixed(0), `${row.bot.right ? "oui" : "non"} (${row.bot.ms.toFixed(0)} ms)`] : ["Solveur ms", "Coup du robot"]);
report("Les 20 puzzles les plus difficiles", puzzleRows, botCells);
console.log(`Coup du robot (recherche, ou solveur exact jusqu'à 8 cartes) : juste ${puzzleRows.filter((row) => row.bot.right).length} / ${puzzleRows.length}.`);
// The move of each seed: two budgets compared position by position (`npm run bench -- 4000`).
report("Milieu de partie", midGames([1, 2, 3, 4], [8, 16, 24]).map(measure), (row) => (row ? [row.moves.join(" ")] : ["Coups joués"]));
console.log(`\nDurée : ${((performance.now() - started) / 1000).toFixed(0)} s`);
