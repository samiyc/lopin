import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { engineFor, rolloutPolicyOf } from "../../../src/sim/bots.js";
import { applyMove, legalMoves } from "../../../src/sim/engine/game.js";
import { coreOf } from "../../../src/sim/heuristics/experimental.js";
import { cloneState, determinize, playOut } from "../../../src/sim/search/lookahead.js";
import { moveKey } from "../../../src/sim/search/search.js";
import { isJoker } from "../../../src/core/cards.js";
import { formatCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";

/**
 * One end-of-game position of a kept duel (scripts/archive/misjudged-endgames.js): the tree's estimate searched again,
 * then where it comes from — the jokers' places, the rollout policy's win rate over random deals of the hidden cards
 * (what the tree believes, without its search) and on the true deal (what it would see with the cards shown).
 */
const BELIEF_DEALS = 100;
/** The rollout policy of `engine`: its `core=` (the 1.2's stfig6 when it names none). */
const policyOf = (engine) => rolloutPolicyOf(coreOf(/[+]core=([^+@]+)/.exec(engine)?.[1] ?? "stfig6"));

function searched(engine, state, seed) {
  const [, budget] = engine.split("@");
  const search = engineFor(engine)(createRng(seed)).searchFor(state, legalMoves(state), {});
  for (let i = 0; i < Number(budget); i += 1) search.step();
  return search.tree().children;
}

const rateOf = (child) => (child?.visits ? child.wins / child.visits : null);

function rootOf(children, played) {
  const ranked = [...children.entries()].sort((a, b) => b[1].visits - a[1].visits);
  const total = ranked.reduce((sum, [, child]) => sum + child.visits, 0);
  const mine = children.get(moveKey(played));
  return { rate: rateOf(mine) ?? rateOf(ranked[0][1]), visits: mine?.visits ?? 0, share: (mine?.visits ?? 0) / total, favourite: rateOf(ranked[0][1]), inTree: Boolean(mine) };
}

/** The share of wins for `player` after `move`, `policy` playing both sides, over `deals` games made by `deal(rng)`. */
function rolled(deal, { move, player, policy }, deals) {
  let wins = 0;
  for (let k = 0; k < deals; k += 1) {
    const rng = createRng(k + 1);
    const game = deal(rng);
    game.endMode = "final";
    applyMove(game, move);
    const winner = game.over ? game.winner : playOut(game, policy(rng));
    if (winner === player) wins += 1;
  }
  return wins / deals;
}

function trueDeal(state) {
  return (rng) => Object.assign(cloneState(state), { rng, pileRng: rng });
}

const jokersIn = (cards) => cards.filter(isJoker).length;

function measured({ log, turn, engine }) {
  const state = stateAt(log, turn);
  const entry = log.turns[turn - 1];
  const player = state.current;
  const played = legalMoves(state).find((move) => formatCard(state.spec, move.card) === entry.move.card && move.border === entry.move.border - 1);
  const root = rootOf(searched(engine, state, log.seed + turn), played);
  const side = { move: played, player, policy: policyOf(engine) };
  return {
    turn, player, pile: state.pile.length, won: log.result.winner === player, decided: log.result.winner !== null, ...root,
    jokers: { mine: jokersIn(state.hands[player]), theirs: jokersIn(state.hands[1 - player]), pile: jokersIn(state.pile) },
    belief: rolled((rng) => determinize(state, player, rng), side, BELIEF_DEALS),
    truth: rolled(trueDeal(state), side, 1),
  };
}

parentPort.on("message", (task) => {
  parentPort.postMessage(task.turns.map((turn) => measured({ log: task.log, turn, engine: task.engine })));
});
