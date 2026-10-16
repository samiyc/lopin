import { addScores } from "../../src/sim/choice.js";

/**
 * The move of an ensemble searched one tree per worker (`thinker.js`), PURE:
 * `replies` are the workers' `move` messages in tree order. The trees' scores
 * are added up as `createEnsemble` does, and the best is the first highest,
 * as the bot's `bestOf`, so the page plays the duels' move. A position that
 * was not searched (solved exactly, or a single move: no rollouts) is the
 * same in every worker: the first one answers.
 */
export function joinReplies(replies) {
  const [first] = replies;
  if (replies.length === 1 || first.rollouts === 0 || !first.scored) return first;
  const scored = addScores(replies.map((reply) => reply.scored));
  const best = scored.reduce((a, b) => (b.gain > a.gain ? b : a));
  return {
    ...first,
    move: best.move,
    scored,
    rollouts: replies.reduce((sum, reply) => sum + reply.rollouts, 0),
    thoughtMs: Math.max(...replies.map((reply) => reply.thoughtMs)),
  };
}
