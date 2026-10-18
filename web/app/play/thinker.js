import { botChoice } from "../replays/runner.js";
import { joinProgress, joinReplies } from "../workers/think-join.js";

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

/** `count` workers, each told which tree of the ensemble is its own; `lab`: the Labo's tree reports (think-worker.js). */
function spawn(player, think, { seed, count, lab, probe }) {
  return Array.from({ length: count }, (_, part) => {
    const worker = new Worker(new URL("../workers/think-worker.js", import.meta.url), { type: "module" });
    worker.postMessage({ type: "init", engine: player.engine, seed, ...think, part, workers: count, lab, probe });
    return worker;
  });
}

const answerWith = (talk, reply) => (talk.answer ? talk.answer(reply) : undefined);

/** A worker's `move` for the decision under way: once every part is in, the joined move answers it. */
function heard(talk, part, data) {
  talk.replies[part] = data;
  if (talk.replies.filter(Boolean).length < talk.count) return undefined;
  const joined = joinReplies(talk.replies);
  talk.thinker.last = { pondered: joined.pondered, rollouts: joined.rollouts, thoughtMs: joined.thoughtMs };
  return answerWith(talk, joined);
}

/** A worker's `progress` (the Labo): the parts' latest, joined, to `onProgress`. */
function progressed(talk, part, data) {
  talk.progress[part] = data;
  if (talk.onProgress) talk.onProgress(joinProgress(talk.progress));
}

const HEARD = { move: heard, progress: progressed, error: (talk) => answerWith(talk, null) };

/** `lab` (the Labo, 17/10): the workers report their trees, and `onProgress({ rollouts, elapsedMs, root })` hears them search. */
export function createThinker(player, think, seed, { lab = false, probe = false, onProgress = null } = {}) {
  if (!think) return { ponder() {}, stop() {}, decide: async (state) => botChoice(state, player) };
  const count = think.workers ?? 1;
  const workers = spawn(player, think, { seed, count, lab, probe });
  const thinker = { last: null };
  // `asked`: each decision's number, so a worker's answer to an earlier one, back after the timeout, is dropped.
  const talk = { thinker, count, onProgress, answer: null, replies: [], progress: [], asked: 0 };
  workers.forEach((worker, part) => {
    worker.onmessage = ({ data }) => (data.id === talk.asked ? HEARD[data.type]?.(talk, part, data) : undefined);
    worker.onerror = () => answerWith(talk, null);
  });
  const decide = (state, log) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => answerWith(talk, null), (think.limitMs ?? 10000) + 2000);
      Object.assign(talk, { replies: [], progress: [], asked: talk.asked + 1 });
      talk.answer = (res) => {
        clearTimeout(timer);
        talk.answer = null;
        resolve(res ?? fallback(thinker, player, state));
      };
      for (const worker of workers) worker.postMessage({ type: "decide", log, id: talk.asked });
    });
  return Object.assign(thinker, {
    ponder: (log) => workers.forEach((worker) => worker.postMessage({ type: "ponder", log })),
    decide,
    stop: () => workers.forEach((worker) => worker.terminate()),
  });
}
