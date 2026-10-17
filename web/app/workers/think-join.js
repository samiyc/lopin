import { addScores } from "../../../src/sim/mcts/choice.js";
import { addRootStats } from "../../../src/sim/mcts/tree-snapshot.js";

/** The Labo's view of the workers' trees (think-worker.js): their root candidates added up, their trees side by side. */
export function joinLab(labs) {
  const trees = labs.filter((lab) => lab?.trees);
  if (trees.length === 0) return labs[0] ?? null;
  return { root: addRootStats(trees.map((lab) => lab.root)), trees: trees.flatMap((lab) => lab.trees) };
}

/** The workers' latest `progress` messages as one: rollouts summed, root candidates added up, the longest time. */
export function joinProgress(parts) {
  const known = parts.filter(Boolean);
  return {
    rollouts: known.reduce((sum, part) => sum + part.rollouts, 0),
    elapsedMs: Math.max(0, ...known.map((part) => part.elapsedMs)),
    root: addRootStats(known.map((part) => part.root)),
  };
}

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
    ...(first.lab === undefined ? {} : { lab: joinLab(replies.map((reply) => reply.lab)) }),
  };
}
