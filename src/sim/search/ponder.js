import { createRng } from "../../core/random.js";
import { applyMove, canPlace, legalMoves } from "../engine/game.js";
import { cloneState, determinize, playOut } from "./lookahead.js";
import { moveKey } from "./search.js";

/**
 * Thinking during the opponent's turn, so that a human who thinks 30 s does
 * not then wait 10 s more.
 *
 * Guessing the human's exact move does not work: it names a card, and the bot
 * cannot tell which of some thirty unseen cards the human holds. But the bot's
 * own moves do not depend on the human's: its hand and its sides stay as they
 * are. So while the human thinks, the bot searches its reply averaged over
 * what the human might do — each step deals the human a hand from the cards
 * the bot cannot see, lets its core play the human's move, then plays out
 * every candidate reply on that deal.
 *
 * When the human has played, `take()` hands these statistics over as a
 * head start (`warm`) for the real search, at half weight — the real move
 * does change things — together with the time spent, of which the real
 * search is credited half (`CREDIT`).
 */
export const PONDER = Object.freeze({ candidates: 8, warmWeight: 0.5, warmCap: 64 });
export const CREDIT = 0.5;

const pointsFor = (winner, player) => {
  if (winner === null) return 0.5;
  return winner === player ? 1 : 0;
};

/** The bot's candidate replies: its core's shortlist as if the human passed. */
function candidateReplies(state, bot, count) {
  const view = cloneState(state);
  view.current = 1 - state.current;
  const scored = bot.base.scoreMoves(view, legalMoves(view));
  return [...scored].sort((a, b) => b.gain - a.gain).slice(0, count).map(({ move }) => ({ move, points: 0, plays: 0 }));
}

/**
 * Starts pondering `state`, the human to move, for `bot` (a `searchBot`).
 * `{ work(ms), take(), rollouts() }`: `work` plays deals for about `ms`;
 * `take` returns `{ warm, spentMs }` for the search after the human's move.
 */
export function createPonder(state, bot, { now = () => performance.now(), limitMs = Infinity, seed = 1, candidates = PONDER.candidates } = {}) {
  const botSeat = 1 - state.current;
  const arms = candidateReplies(state, bot, candidates);
  const rng = createRng(seed);
  const humanCore = bot.policy(createRng(seed ^ 0x9e3779b9));
  const rollout = bot.policy(createRng(seed ^ 0x85ebca6b));
  let spentMs = 0;
  let rollouts = 0;
  const step = () => {
    const deal = determinize(state, botSeat, rng);
    const replies = legalMoves(deal);
    applyMove(deal, replies.length > 0 ? humanCore.choose(deal, replies) : null);
    for (const arm of arms) {
      if (deal.over || !canPlace(deal, botSeat, arm.move.card, arm.move.border)) continue;
      const game = cloneState(deal);
      applyMove(game, arm.move);
      arm.points += pointsFor(playOut(game, rollout), botSeat);
      arm.plays += 1;
      rollouts += 1;
    }
  };
  return {
    rollouts: () => rollouts,
    /** Plays deals for about `ms`; false once the time allowed is used up. */
    work(ms) {
      const started = now();
      while (now() - started < ms && spentMs < limitMs && arms.length > 0) step();
      spentMs += now() - started;
      return spentMs < limitMs && arms.length > 0;
    },
    take() {
      const warm = new Map(arms.filter((arm) => arm.plays > 0).map((arm) => [moveKey(arm.move), { points: arm.points, plays: arm.plays }]));
      return { warm, spentMs };
    },
  };
}
