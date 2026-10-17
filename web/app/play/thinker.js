import { botChoice } from "../replays/runner.js";
import { joinReplies } from "../workers/think-join.js";

/**
 * How the page asks a bot for its move. Most bots answer on the spot. A bot
 * of the line-up with a `think` setting (`src/config/bots.js`) — the
 * experimental one, the Oracle light — thinks in a worker (`think-worker.js`):
 * up to `think.limitMs` a move, and during the human's turn too when its
 * search takes a head start. `think.workers` > 1 runs an ensemble
 * (`+trees=k`) one tree per worker, their scores added up (`think-join.js`).
 *
 * `{ ponder(log), decide(state, log) → Promise<{ move, scored }>, stop() }`.
 */
const fallback = (thinker, player, state) => {
  thinker.last = { pondered: 0, rollouts: 0, thoughtMs: 0 };
  return botChoice(state, player);
};

/** `count` workers, each told which tree of the ensemble is its own. */
function spawn(player, think, seed, count) {
  return Array.from({ length: count }, (_, part) => {
    const worker = new Worker(new URL("../workers/think-worker.js", import.meta.url), { type: "module" });
    worker.postMessage({ type: "init", engine: player.engine, seed, ...think, part, workers: count });
    return worker;
  });
}

export function createThinker(player, think, seed) {
  if (!think) return { ponder() {}, stop() {}, decide: async (state) => botChoice(state, player) };
  const count = think.workers ?? 1;
  const workers = spawn(player, think, seed, count);
  let answer = null;
  let replies = [];
  // Each decision's number: a worker's answer to an earlier one, back after the timeout, is dropped.
  let asked = 0;
  const thinker = { last: null };
  workers.forEach((worker, part) => {
    worker.onmessage = ({ data }) => {
      if (data.id !== asked) return undefined;
      if (data.type === "error") return answer?.(null);
      if (data.type !== "move") return undefined;
      replies[part] = data;
      if (replies.filter(Boolean).length < count) return undefined;
      const joined = joinReplies(replies);
      thinker.last = { pondered: joined.pondered, rollouts: joined.rollouts, thoughtMs: joined.thoughtMs };
      return answer?.(joined);
    };
    worker.onerror = () => answer?.(null);
  });
  const decide = (state, log) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => answer?.(null), (think.limitMs ?? 10000) + 2000);
      replies = [];
      asked += 1;
      answer = (res) => {
        clearTimeout(timer);
        answer = null;
        resolve(res ?? fallback(thinker, player, state));
      };
      for (const worker of workers) worker.postMessage({ type: "decide", log, id: asked });
    });
  return Object.assign(thinker, {
    ponder: (log) => workers.forEach((worker) => worker.postMessage({ type: "ponder", log })),
    decide,
    stop: () => workers.forEach((worker) => worker.terminate()),
  });
}
