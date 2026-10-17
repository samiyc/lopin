import { parentPort } from "node:worker_threads";
import { DECKS, JOKER_RULES } from "../../../src/config/decks.js";
import { ORDERS } from "../../../src/config/formations.js";
import { figureOf, isFigure } from "../../../src/core/figures.js";
import { createRng } from "../../../src/core/random.js";
import { engineFor } from "../../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../../src/sim/engine/game.js";

/**
 * The extension's balance (scripts/extension.js): whole games at the page's
 * rule, the same engine on both sides, with the figures of one configuration
 * in the pile. Each figure laid is noted — who, when, beside which border —
 * and, at the end, whether that player won the border and the game.
 */
function playOne({ figures, engine, seed }) {
  const game = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed), endMode: "claim-end", figures });
  const bots = [engineFor(engine)(createRng(seed * 2 + 1)), engineFor(engine)(createRng(seed * 2 + 2))];
  const laid = [];
  for (let guard = 0; !game.over && guard < 300; guard += 1) {
    const moves = legalMoves(game);
    const move = moves.length > 0 ? bots[game.current].choose(game, moves) : null;
    // The border object itself: it keeps its identity when a Dame de Cœur moves it.
    if (move && isFigure(move.card)) laid.push({ key: figureOf(move.card).key, player: game.current, turn: game.turn + 1, border: game.borders[move.border] });
    applyMove(game, move);
  }
  return {
    winner: game.winner,
    turns: game.turn,
    laid: laid.map(({ key, player, turn, border }) => ({ key, player, turn, wonBorder: border.owner === player, wonGame: game.winner === player })),
  };
}

parentPort.on("message", ({ config, figures, engine, seeds }) => {
  parentPort.postMessage({ config, games: seeds.map((seed) => playOne({ figures, engine, seed })) });
});
