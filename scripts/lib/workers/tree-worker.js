import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { engineFor } from "../../../src/sim/bots.js";
import { rulesOf, stateAt } from "../../../src/replay/core/log.js";
import { inspectTree } from "../domain/tree-inspector.js";

function executeSearch(task) {
  const { gameLog, turn, engineId, budget, seed } = task;
  const { spec } = rulesOf(gameLog.rules);
  const state = stateAt(gameLog, turn);
  const moves = legalMoves(state);

  const rng = createRng(seed);
  const bot = engineFor(engineId)(rng);

  const search = bot.searchFor(state, moves);
  for (let i = 0; i < budget; i += 1) {
    search.step();
  }

  const rootMoves = search.scored?.().map((s) => s.move) ?? [];
  return inspectTree(search.tree(), rootMoves, spec);
}

parentPort.on("message", (task) => {
  try {
    const metrics = executeSearch(task);
    parentPort.postMessage({
      ok: true,
      turn: task.turn,
      engineKey: task.engineKey,
      engineId: task.engineId,
      budget: task.budget,
      metrics,
    });
  } catch (err) {
    parentPort.postMessage({
      ok: false,
      turn: task?.turn,
      engineKey: task?.engineKey,
      error: String(err?.stack ?? err),
    });
  }
});
