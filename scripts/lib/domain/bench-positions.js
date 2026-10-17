import { readFile } from "node:fs/promises";
import { OFFICIAL_RULES } from "../../../src/config/rules.js";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { rulesOf, stateAt } from "../../../src/replay/core/log.js";
import { engineFor } from "../../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../../src/sim/engine/game.js";

/**
 * The positions `npm run bench` searches: the hardest puzzles (fewest
 * winning moves among the legal ones, the core's own choice failing first),
 * whose winning moves the exact solver already knows; and mid-game positions
 * from seeded Stratège games, where rollouts are long and speed is what counts.
 */
const difficulty = (puzzle) => [puzzle.solutions.length / puzzle.moves, puzzle.coreFails ? 0 : 1, -puzzle.cardsLeft];

function harder(a, b) {
  const [x, y] = [difficulty(a), difficulty(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export async function hardestPuzzles(count) {
  const { puzzles } = JSON.parse(await readFile(new URL("../../../web/data/puzzles.json", import.meta.url), "utf8"));
  // Endgames only: a "gain immédiat" keeps a pile, which the solver cannot see through.
  return puzzles.filter((puzzle) => puzzle.kind !== "immediate").sort(harder).slice(0, count).map((puzzle) => ({
    id: `puzzle ${puzzle.id}`,
    state: stateAt(puzzle.log, puzzle.log.turns.length + 1),
    solutions: new Set(puzzle.solutions),
  }));
}

/** The position before move `turn` of a seeded Stratège-against-Stratège game, under the page's rules. */
function midGame(seed, turn) {
  const rng = createRng(seed);
  const bots = [engineFor("strategist")(rng), engineFor("strategist")(rng)];
  const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  while (!state.over && state.turn < turn) applyMove(state, bots[state.current].choose(state, legalMoves(state)));
  return state.over ? null : { id: `partie ${seed}, tour ${turn}`, state, solutions: null };
}

export function midGames(seeds, turns) {
  return seeds.flatMap((seed) => turns.map((turn) => midGame(seed, turn))).filter(Boolean);
}

export const moveText = (state, move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;
