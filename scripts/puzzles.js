import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadGame, readIndex } from "./lib/game-index.js";
import { runPool, workerCount } from "./lib/pool.js";
import { STATUS, borderStatus } from "../src/sim/certainty.js";
import { isForkBorder } from "../src/sim/fork.js";
import { stateAt } from "../src/replay/log.js";

/**
 * `npm run puzzles -- [--minutes N] [--count 50] [--source duels] [--add]`:
 * endgame puzzles. Once the pile is empty every card is known and
 * `src/sim/endgame.js` solves the end exactly; a puzzle is a position won for
 * the side to move through few of its moves (at most `SHARE` of them), two per
 * game at most. Strong games are rarely delicate at the very end: 4 544
 * endgames at 30 % gave only 19.
 *
 * The games are the self-play ones (selfplay/, `npm run selfplay`, the final
 * rule) or, with `--source duels`, the bot games kept in duels/ (the page's
 * claim rule, which the solver and the page play as well).
 *
 * The best `--count` — fewest solutions, then deepest, then those the fast
 * strategist gets wrong — go to web/data/puzzles.json, where the page reads
 * them. Without `--add` they replace the endgames there, numbered from 1; with
 * `--add` they join them, numbered after the highest id of the file, and a
 * position already there is not taken twice: the solved ones and the
 * favourites, kept in the browser by id, stay right. 10 minutes at most.
 *
 * Shaping the set (Sami, 06/10: his favourites have twice the moves, and the
 * strategist's move loses in most of them): `--min-moves N` keeps positions
 * with at least N legal moves, `--core-fails` those where the strategist's
 * move does not win, `--unique` those with one winning move. `--keep 2,3,…`
 * keeps only those ids of the file (the others are dropped); new ids still
 * start after the highest id the file had, so a dropped id is never reused.
 *
 * `--fork` (Sami, 11/10, Connect Four's « fourchette »): only the endgames
 * whose every winning move plays on a border whose win would leave a double
 * threat (src/sim/fork.js); they carry `kind: "fork"` and, with
 * numbered from 401 at least; `--fork` always adds. Without `--add`, every
 * puzzle of another kind (immediate, fork) is kept as it is.
 */
const SHARE = 0.5;
const PER_GAME = 2;
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const minutes = Math.min(20, Number(option("--minutes", 10)) || 10);
const count = Number(option("--count", 50));
const fromDuels = option("--source", "selfplay") === "duels";
const adding = args.includes("--add");
const minMoves = Number(option("--min-moves", 0));
const coreFailsOnly = args.includes("--core-fails");
const uniqueOnly = args.includes("--unique");
const keepIds = args.includes("--keep") ? new Set(option("--keep", "").split(",").map(Number)) : null;
/** Does a found puzzle pass the shaping options? */
const forkOnly = args.includes("--fork");
/**
 * Does every winning move of a found puzzle play for a decisive or double-threat border (fork.js)? `--fork` only.
 * A border counts as won once it is proven (certainty.js), claimed or not: the self-play games settle at the end.
 */
function playsTheFork(p, logs) {
  const state = stateAt(logs[p.index], p.turn);
  const provenFor = (index) => [state.current, 1 - state.current].find((player) => borderStatus(state, index, player) === STATUS.won);
  const owners = state.borders.map((border, index) => border.owner ?? provenFor(index) ?? null);
  return p.solutions.every((solution) => isForkBorder(owners, state.current, state.spec, Number(solution.split("→")[1]) - 1));
}
const wanted = (p) => p.moves >= minMoves && (!coreFailsOnly || p.coreFails) && (!uniqueOnly || p.solutions.length === 1);
// Under the claim rule the pile runs out after move 30; under the final rule a little later in these games.
const TURNS = fromDuels ? [31, 32, 33, 34, 35, 36, 37] : [33, 34, 35, 36, 37];
const DIR = fileURLToPath(new URL("../web/data/", import.meta.url));

async function sourceLogs() {
  if (!fromDuels) return JSON.parse(await readFile(fileURLToPath(new URL("../selfplay/experimental_80.json", import.meta.url)), "utf8"));
  const logs = [];
  for (const row of await readIndex()) logs.push(await loadGame(row));
  return logs;
}

const keyOf = (log, turn) => `${log.deck.join(" ")}|${turn}`;

/** Fewest solutions first, then the deepest, then those the strategist gets wrong. */
function byRichness(a, b) {
  return a.solutions.length - b.solutions.length || b.cardsLeft - a.cardsLeft || Number(a.coreFails === false) - Number(b.coreFails === false);
}

function choose(found) {
  const chosen = [];
  for (const puzzle of found.sort(byRichness)) {
    if (chosen.filter((other) => other.index === puzzle.index).length >= PER_GAME) continue;
    chosen.push(puzzle);
    if (chosen.length === count) break;
  }
  return chosen;
}

const started = Date.now();
const previous = await readFile(`${DIR}puzzles.json`, "utf8").then((text) => JSON.parse(text).puzzles, () => []);
// `--fork` always adds: its puzzles join the file, they never replace the endgames.
const carried = adding || forkOnly ? previous : previous.filter((puzzle) => puzzle.kind !== undefined);
const kept = keepIds ? carried.filter((puzzle) => keepIds.has(puzzle.id)) : carried;
// Every position the file had, dropped ones included: a puzzle taken out is not brought back.
const taken = new Set(previous.map((puzzle) => keyOf(puzzle.log, puzzle.turn)));
const logs = await sourceLogs();
const items = logs.flatMap((log, index) => TURNS.filter((turn) => turn <= log.turns.length && !taken.has(keyOf(log, turn))).map((turn) => ({ index, log, turn })));
const threads = workerCount();
const tasks = Array.from({ length: threads }, (_, t) => ({ items: items.filter((_, i) => i % threads === t), share: SHARE, seconds: minutes * 60 }));
const found = (await runPool(new URL("./lib/puzzle-worker.js", import.meta.url), tasks)).flat();
const chosen = choose(found.filter((p) => wanted(p) && (!forkOnly || playsTheFork(p, logs))));

const strip = (log, turn) => ({ format: log.format, rules: log.rules, deck: log.deck, turns: log.turns.slice(0, turn - 1).map(({ turn: t, player, move, pass, drew }) => ({ turn: t, player, move, pass, drew })) });
// Fork puzzles start at 401 at least, after every id the file had.
const floorId = forkOnly ? 400 : 0;
const firstId = adding || forkOnly ? Math.max(floorId, ...previous.map((puzzle) => puzzle.id)) + 1 : 1;
const puzzles = chosen.map((p, i) => ({ id: firstId + i, ...(forkOnly ? { kind: "fork" } : {}), turn: p.turn, cardsLeft: p.cardsLeft, moves: p.moves, solutions: p.solutions, coreMove: p.coreMove, coreFails: p.coreFails, log: strip(logs[p.index], p.turn) }));
await mkdir(DIR, { recursive: true });
// Without --add the puzzles of another kind ("gain immédiat", `npm run puzzles:immediate`; fork) are kept as they are; with it, everything is.
const endgamesKept = kept.filter((puzzle) => puzzle.kind === undefined || puzzle.kind === "fork");
const immediate = kept.filter((puzzle) => puzzle.kind === "immediate");
await writeFile(`${DIR}puzzles.json`, `${JSON.stringify({ generatedAt: new Date().toISOString(), puzzles: [...endgamesKept, ...puzzles, ...immediate] })}\n`);
const unique = puzzles.filter((p) => p.solutions.length === 1).length;
process.stdout.write(`${items.length} fins de partie examinées, ${found.length} puzzles possibles, ${puzzles.length} ${adding ? "ajoutés" : "gardés"} (${unique} à solution unique, ${puzzles.filter((p) => p.coreFails).length} où le Stratège se trompe) — ${((Date.now() - started) / 60000).toFixed(1)} min\n`);
