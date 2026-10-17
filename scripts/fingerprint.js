import { createHash } from "node:crypto";
import { DECKS, JOKER_RULES } from "../src/config/decks.js";
import { ORDERS } from "../src/config/formations.js";
import { createRng } from "../src/core/random.js";
import { engineFor } from "../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../src/sim/engine/game.js";

/**
 * `npm run fingerprint -- <engine,engine> [games]`: plays seeded games and
 * prints a hash of every move, with the time a game takes. An optimisation
 * must leave the hash unchanged — same moves, only faster.
 *
 *   npm run fingerprint -- strategist,greedy 150
 */
const [pair = "strategist,greedy", gamesArg = "150"] = process.argv.slice(2);
const engines = pair.split(",");
const games = Number(gamesArg);
const hash = createHash("sha256");
const started = performance.now();
for (let g = 0; g < games; g += 1) {
  const rng = createRng(1000 + g);
  const bots = engines.map((id) => engineFor(id)(rng));
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng });
  while (!state.over) {
    const moves = legalMoves(state);
    const move = moves.length > 0 ? bots[state.current].choose(state, moves) : null;
    hash.update(move ? `${move.card}:${move.border};` : "p;");
    applyMove(state, move);
  }
  hash.update(`W${state.winner}|`);
}
const perGame = (performance.now() - started) / games;
process.stdout.write(`${engines.join(" contre ")} — ${games} parties, empreinte ${hash.digest("hex").slice(0, 16)}, ${perGame.toFixed(1)} ms par partie\n`);
