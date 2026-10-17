import { adviseMove, createAdvisor } from "../../../src/replay/stats/advice.js";
import { stateAt } from "../../../src/replay/core/log.js";

/**
 * The replay viewer's second opinion, off the page's thread: for each human
 * move of a replay, what the Stratège 2.1 would have played
 * (`src/replay/stats/advice.js`, about 0.2 s a move). In: `{ id, log }`. Out, one
 * message per move as it is ready: `{ id, index, opinion }` (`index` the
 * viewer's frame), then `{ id, done: true }`.
 */
const advisor = createAdvisor();

self.onmessage = ({ data: { id, log } }) => {
  log.turns.forEach((entry, i) => {
    if (entry.pass || !entry.move || entry.candidates) return;
    // One move that cannot be weighed must not leave the others waiting.
    let opinion = { advice: [], adviceGap: null, refused: false, playedRate: null };
    try {
      opinion = adviseMove(advisor, stateAt(log, entry.turn), entry);
    } catch (error) {
      console.error("avis du Stratège 2.1, tour", entry.turn, error);
    }
    self.postMessage({ id, index: i + 1, opinion });
  });
  self.postMessage({ id, done: true });
};
