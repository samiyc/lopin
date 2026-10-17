import {
  DUEL_CHALLENGERS,
  DUEL_ROW,
  PREVIOUS_BOT,
  PREVIOUS_BOT_ROWS,
  REFERENCE_BOT,
  SEED,
  SIMULATIONS,
  SOLO_RUNS,
} from "../config/simulations.js";
import { mergeTallies } from "../sim/engine/simulate.js";
import { mergeSoloTallies } from "../sim/engine/solo.js";

/**
 * Work units for the thread pool, cut in chunks so threads stay balanced.
 * Seeds follow the task index, so a merged result does not depend on which
 * thread finished first. Groups:
 *
 * - `row`: one simulation row, reference bot against itself, random against
 *   random, and the previous bot against itself on the compared rows;
 * - `duel`: each challenger against the previous bot, from both seats;
 * - `solo`: Sami's solo protocol, the exact optimum spread over the chunks.
 */
export function simulationTasks(sizes, chunk = 100) {
  const tasks = [];
  const add = (base, total, extra = () => ({})) => {
    const chunks = Math.ceil(total / chunk);
    for (let c = 0; c < chunks; c += 1) {
      const games = Math.min(chunk, total - c * chunk);
      tasks.push({ ...base, games, seed: SEED + tasks.length * 7919, ...extra(chunks) });
    }
  };
  for (const row of SIMULATIONS) {
    add({ group: "row", ...row, players: [REFERENCE_BOT, REFERENCE_BOT] }, sizes.games);
    add({ group: "row", ...row, players: ["random", "random"] }, sizes.baselineGames);
    if (PREVIOUS_BOT_ROWS.includes(row.id)) add({ group: "row", ...row, players: [PREVIOUS_BOT, PREVIOUS_BOT] }, sizes.games);
  }
  const sanity = { group: "row", ...DUEL_ROW, id: "sanity" };
  add({ ...sanity, players: [REFERENCE_BOT, "random"] }, sizes.baselineGames);
  add({ ...sanity, players: ["random", REFERENCE_BOT] }, sizes.baselineGames);
  for (const challenger of DUEL_CHALLENGERS) {
    const duel = { group: "duel", ...DUEL_ROW, id: challenger };
    add({ ...duel, players: [challenger, PREVIOUS_BOT] }, sizes.duelGames);
    add({ ...duel, players: [PREVIOUS_BOT, challenger] }, sizes.duelGames);
  }
  for (const run of SOLO_RUNS) {
    add({ group: "solo", kind: "solo", ...run }, sizes.soloGames, (chunks) => ({
      optimumGames: Math.ceil(sizes.soloOptimumGames / chunks),
    }));
  }
  return tasks;
}

const matchup = (players) => players.join("-");

function groupKey(task) {
  return `${task.group}|${task.id}|${task.players ? matchup(task.players) : ""}`;
}

function place(out, task, tallies) {
  const meta = { deck: task.deck, jokerRule: task.jokerRule, order: task.order };
  if (task.group === "solo") {
    out.solo[task.id] = { ...meta, bot: task.bot, ...mergeSoloTallies(tallies) };
  } else if (task.group === "duel") {
    out.duels[task.id] ??= meta;
    out.duels[task.id][task.players[0] === task.id ? "first" : "second"] = mergeTallies(tallies);
  } else {
    out.simulations[task.id] ??= meta;
    out.simulations[task.id][matchup(task.players)] = mergeTallies(tallies);
  }
}

/** `{ simulations, duels, solo }` from the task results. */
export function assembleResults(tasks, results) {
  const groups = new Map();
  tasks.forEach((task, i) => {
    const key = groupKey(task);
    if (!groups.has(key)) groups.set(key, { task, tallies: [] });
    groups.get(key).tallies.push(results[i]);
  });
  const out = { simulations: {}, duels: {}, solo: {} };
  for (const { task, tallies } of groups.values()) place(out, task, tallies);
  return out;
}
