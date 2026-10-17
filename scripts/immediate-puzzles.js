import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { OFFICIAL_RULES } from "../src/config/rules.js";
import { formatCard } from "../src/core/notation.js";
import { createRng } from "../src/core/random.js";
import { playLogged, rulesOf, startLog } from "../src/replay/core/log.js";
import { engineFor } from "../src/sim/bots.js";
import { createGame, legalMoves } from "../src/sim/engine/game.js";
import { winsAtOnce } from "../src/sim/eval/immediate.js";

/**
 * `npm run puzzles:immediate`: mid-game puzzles under the claim rule. In
 * seeded Stratège self-play, a position is kept when some moves — but not
 * most — win at once, the move proving enough borders to claim the game
 * (`immediate.js`), and the fast core itself misses them. The pile is not
 * empty: the opponent's hand stays hidden, and the proof does not need it.
 * They join the endgame puzzles in web/data/puzzles.json, marked
 * `kind: "immediate"`; running it again replaces them. Ids from 201: the
 * 101-120 of 30/09 were won a move later, under the old claim rule, and may
 * already be marked solved. A few seconds.
 *
 * `--add [--count 20]` keeps the ones already there and adds new ones,
 * numbered after the highest id of the file, a position already there never
 * taken twice: the solved ones and the favourites, kept by id, stay right.
 */
const args = process.argv.slice(2);
const adding = args.includes("--add");
const GAMES = 4000;
const COUNT = Number(args.includes("--count") ? args[args.indexOf("--count") + 1] : 20);
const SHARE = 0.25;
const text = (state, move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;

function examine(state) {
  const moves = legalMoves(state);
  if (state.pile.length === 0 || moves.length < 6) return null;
  const winning = moves.filter((move) => winsAtOnce(state, move));
  if (winning.length === 0 || winning.length / moves.length > SHARE) return null;
  const coreMove = engineFor("strategist")(createRng(1)).choose(state, moves);
  if (winning.some((move) => move.card === coreMove.card && move.border === coreMove.border)) return null;
  return { moves: moves.length, solutions: winning.map((move) => text(state, move)), coreMove: text(state, coreMove) };
}

function gamePuzzle(seed) {
  const rng = createRng(seed);
  const bots = [engineFor("strategist")(rng), engineFor("strategist")(rng)];
  const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  const log = startLog(state, { rules: OFFICIAL_RULES, players: [], seed, startedAt: "" });
  while (!state.over) {
    const found = examine(state);
    if (found) return { ...found, turn: state.turn + 1, cardsLeft: state.pile.length, log: JSON.parse(JSON.stringify(log)) };
    const moves = legalMoves(state);
    playLogged(log, state, moves.length > 0 ? bots[state.current].choose(state, moves) : null);
  }
  return null;
}

const started = Date.now();
const file = fileURLToPath(new URL("../web/data/puzzles.json", import.meta.url));
const data = JSON.parse(await readFile(file, "utf8"));
const keyOf = (log, turn) => `${log.deck.join(" ")}|${turn}`;
const taken = new Set(adding ? data.puzzles.map((puzzle) => keyOf(puzzle.log, puzzle.turn)) : []);
const found = [];
for (let seed = 1; seed <= GAMES && found.length < COUNT; seed += 1) {
  const puzzle = gamePuzzle(seed);
  if (puzzle && !taken.has(keyOf(puzzle.log, puzzle.turn))) found.push(puzzle);
}
const endgames = data.puzzles.filter((puzzle) => adding || puzzle.kind !== "immediate");
const firstId = adding ? Math.max(200, ...data.puzzles.map((puzzle) => puzzle.id)) + 1 : 201;
const strip = (log) => ({ format: log.format, rules: log.rules, deck: log.deck, turns: log.turns.map(({ turn, player, move, pass, drew }) => ({ turn, player, move, pass, drew })) });
const immediate = found.map((p, i) => ({ id: firstId + i, kind: "immediate", turn: p.turn, cardsLeft: p.cardsLeft, moves: p.moves, solutions: p.solutions, coreMove: p.coreMove, coreFails: true, log: strip(p.log) }));
await writeFile(file, `${JSON.stringify({ ...data, puzzles: [...endgames, ...immediate] })}\n`);
process.stdout.write(`${immediate.length} puzzles « gain immédiat » ${adding ? "ajoutés" : "gardés"}, ${endgames.length} autres inchangés — ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
