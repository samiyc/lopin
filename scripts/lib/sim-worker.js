import { parentPort } from "node:worker_threads";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { playRecordedBatch } from "../../src/replay/bot-games.js";
import { playBatch } from "../../src/sim/simulate.js";
import { playSoloBatch } from "../../src/sim/solo.js";

/** A batch of two-player games: tallies, or with `keepLogs` every game as a replay (`src/replay/bot-games.js`). */
function duelBatch(spec, common, task) {
  const options = { ...common, players: task.players, deals: task.deals ?? null, dealSeeds: task.dealSeeds ?? null, handClass: task.handClass ?? null, endMode: task.endMode ?? "early", openHands: Boolean(task.openHands) };
  if (task.keepLogs) return playRecordedBatch(spec, { ...options, labels: task.labels, ids: { deck: task.deck, jokerRule: task.jokerRule, order: task.order } });
  return playBatch(spec, { ...options, deck: task.fixedDeck ?? null, keepWinners: Boolean(task.keepWinners) });
}

/** One pool task: a batch of two-player games, or of solo games (`kind: "solo"`). */
parentPort.on("message", (task) => {
  const spec = DECKS[task.deck];
  const common = {
    order: ORDERS[task.order],
    jokerRule: JOKER_RULES[task.jokerRule],
    games: task.games,
    seed: task.seed,
  };
  const tally =
    task.kind === "solo"
      ? playSoloBatch(spec, { ...common, habits: task.habits, optimumGames: task.optimumGames })
      : duelBatch(spec, common, task);
  parentPort.postMessage(tally);
});
