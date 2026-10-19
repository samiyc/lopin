import { parentPort } from "node:worker_threads";
import { isJoker } from "../../../src/core/cards.js";
import { createRng } from "../../../src/core/random.js";
import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { rolloutPolicyOf } from "../../../src/sim/bots.js";
import { applyMove, legalMoves } from "../../../src/sim/engine/game.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { coreOf } from "../../../src/sim/heuristics/experimental.js";
import { cloneState, determinize, unseenList } from "../../../src/sim/search/lookahead.js";

/**
 * Where the rollout policy goes wrong in an overrated endgame (scripts/archive/misjudged-endgames.js `--trace`): on
 * each deal the mover cannot tell apart where the policy wins but perfect play loses, the policy's game is followed
 * move by move, every position solved with the cards seen, and the first move that hands the mover the win is kept —
 * who made it, the card, whether it is a joker, and the move the solver would have played.
 */
const policyOf = rolloutPolicyOf(coreOf("stfig6"));
const SAMPLED = 12;
const NODES = 1_500_000;

function dealsOf(state, player) {
  if (state.pile.length !== 1) return Array.from({ length: SAMPLED }, (_, k) => determinize(state, player, createRng(k + 1)));
  const unseen = unseenList(state, player);
  return unseen.map((card, k) => Object.assign(cloneState(state), { pile: [card], hands: player === 0 ? [[...state.hands[0]], unseen.filter((_, j) => j !== k)] : [unseen.filter((_, j) => j !== k), [...state.hands[1]]] }));
}

/** The exact value of `game` for `player`, null if the solver ran out; `best`: the winning or least bad move. */
function valueFor(game, player) {
  if (game.over) return { value: game.winner === player ? 1 : -1 };
  const solution = solveEndgame(game, { stopAtWin: true, maxNodes: NODES });
  if (!solution.complete) return null;
  return { value: game.current === player ? solution.value : -solution.value, best: solution.moves[0]?.move };
}

const sideOf = (game, border, player) => game.borders[border].sides[player].length;

function describe(game, move, best, mover) {
  const actor = game.current;
  return {
    actor: actor === mover ? "joueur" : "adversaire", pile: game.pile.length, joker: isJoker(move.card), held: game.hands[actor].filter(isJoker).length,
    card: formatCard(game.spec, move.card), border: move.border + 1, best: best && `${formatCard(game.spec, best.card)}→${best.border + 1}`, bestJoker: Boolean(best && isJoker(best.card)),
    fills: sideOf(game, move.border, actor) === 2, closed: game.borders[move.border].owner !== null && game.borders[move.border].owner !== undefined,
  };
}

/** The policy's game from `deal` after `move`, at the page's rule: the first move that turns the mover's loss into a win. */
function traced(deal, move, mover) {
  const game = Object.assign(cloneState(deal), { endMode: "claim-end" });
  applyMove(game, move);
  const rng = createRng(1);
  Object.assign(game, { rng, pileRng: rng });
  const policy = policyOf(rng);
  let before = valueFor(game, mover);
  if (!before || before.value > 0) return null;
  while (!game.over) {
    const moves = legalMoves(game);
    const chosen = moves.length > 0 ? policy.choose(game, moves) : null;
    const snapshot = chosen && describe(game, chosen, before.best, mover);
    applyMove(game, chosen);
    const after = valueFor(game, mover);
    if (!after) return { unsolved: true };
    if (after.value > before.value) return snapshot;
    before = after;
  }
  return { none: true, won: game.winner === mover };
}

parentPort.on("message", ({ log, turn }) => {
  const state = stateAt(log, turn);
  const entry = log.turns[turn - 1];
  const mover = state.current;
  const move = legalMoves(state).find((m) => formatCard(state.spec, m.card) === entry.move.card && m.border === entry.move.border - 1);
  parentPort.postMessage(dealsOf(state, mover).map((deal) => traced(deal, move, mover)).filter(Boolean));
});
