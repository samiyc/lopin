import { engineOf } from "../../config/bots.js";
import { formatCard } from "../../core/notation.js";
import { createRng } from "../../core/random.js";
import { engineFor } from "../../sim/bots.js";
import { legalMoves } from "../../sim/engine/game.js";

/**
 * The Stratège's opinion on a human move, for the replay viewer (Sami, 03/10):
 * the line-up's Stratège (2.1, the core plus look-ahead) plays 16 endgames for
 * each of its 4 best moves, and for the move actually played too, on the same
 * deals — so the move played gets a share of games won that compares with
 * the Stratège's own. Too slow to run as a replay opens: the viewer asks a
 * worker (`web/app/workers/advice-worker.js`).
 *
 * Returns `{ advice, adviceGap, refused, playedRate }`: the judged moves, best
 * first, their `gain` the share of endgames won; how much less the move
 * played won than the best; and whether the Stratège refuses that move at all
 * (a joker off a pair).
 */
export const createAdvisor = () => engineFor(engineOf("stratege"))(createRng(1));

const labelOf = (spec, move) => ({ card: formatCard(spec, move.card), border: move.border + 1 });
const isPlayed = (spec, entry) => ({ move }) => formatCard(spec, move.card) === entry.move.card && move.border === entry.move.border - 1;

const NO_OPINION = Object.freeze({ advice: [], adviceGap: null, refused: false, playedRate: null });

export function adviseMove(advisor, state, entry) {
  const moves = legalMoves(state);
  // A single legal move is played out by nobody: there is nothing to weigh.
  if (moves.length <= 1) return NO_OPINION;
  const played = moves.find((move) => isPlayed(state.spec, entry)({ move }));
  const scored = advisor.scoreMoves(state, moves, { keepAll: true, include: played });
  // Only the moves played out have a share of games won; the rest keep the core's rank below zero.
  const judged = scored.filter((candidate) => candidate.gain >= 0 && !candidate.refused).sort((a, b) => b.gain - a.gain);
  const advice = judged.map(({ move, gain }) => ({ ...labelOf(state.spec, move), gain: Number(gain.toFixed(4)) }));
  const mine = scored.find(isPlayed(state.spec, entry));
  if (judged.length === 0) return NO_OPINION;
  if (!mine || mine.refused) return { advice, adviceGap: null, refused: Boolean(mine), playedRate: null };
  return { advice, adviceGap: Math.max(0, judged[0].gain - mine.gain), refused: false, playedRate: mine.gain };
}
