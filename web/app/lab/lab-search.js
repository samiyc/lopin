import { $ } from "../board/dom.js";
import { createThinker } from "../play/thinker.js";
import { enginePlayer } from "../replays/runner.js";
import { LAB_LIMIT_MS, thinkOf } from "./engine-builder.js";

/**
 * One search of a position on show, in workers, for « Rejouer ce coup avec… » and « L'avis des juges »: `engine` is
 * any engine id, `log` the game and `turn` the decision (the position the table shows before it). The workers stay
 * under the Labo's cap; the profiler's box adds a probe. Resolves to the worker's reply (`move`, `scored`, `lab`, …).
 */
const capOf = () => Math.max(1, Number.parseInt($("lab-workers").value, 10) || 1);

export const probing = () => Boolean($("lab-probe")?.checked);

export async function searchPosition({ engine, seed, log, turn, state, onProgress = null }) {
  const think = thinkOf(engine, { cap: capOf(), limitMs: LAB_LIMIT_MS });
  const thinker = createThinker(enginePlayer(engine, seed), think, seed, { lab: true, probe: probing(), onProgress });
  try {
    return await thinker.decide(state, { ...log, turns: log.turns.slice(0, turn - 1), result: null, endedAt: null });
  } finally {
    thinker.stop();
  }
}
