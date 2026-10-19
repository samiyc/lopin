import { readFile, writeFile } from "node:fs/promises";
import { createRng } from "../src/core/random.js";
import { stateAt } from "../src/replay/core/log.js";
import { BOT_PARAMS, rolloutPolicyOf } from "../src/sim/bots.js";
import { bestMoves, solveEndgame } from "../src/sim/eval/endgame.js";
import { EXPERIMENT, coreOf } from "../src/sim/heuristics/experimental.js";
import { legalMoves } from "../src/sim/engine/game.js";

/**
 * `npm run policy`: how good is the bot that plays the search's rollouts?
 * The search can only be as right as its simulated games, and `npm run duel
 * -- experimental:4000 experimental:400` showed that more of them do not
 * help. Here the solver gives the truth: in self-play endgames (pile empty,
 * 9 cards or fewer, selfplay/), positions won for the side to move where some
 * moves throw the win away. The score is the share of the policy's choices
 * that keep the win, over three seeds (its tie-breaks are random), on all of
 * them and on the delicate ones (half the moves or fewer keep the win).
 *
 * The solved positions are cached in selfplay/policy-positions.json: only
 * the first run pays for the solver (about 4 minutes), later ones take
 * seconds. A new policy is measured here before any duel.
 */
const withParams = (changes) => rolloutPolicyOf({ ...EXPERIMENT, params: { ...BOT_PARAMS, ...changes } });
const POLICIES = {
  "0.7": rolloutPolicyOf(EXPERIMENT),
  "température 0,25": withParams({ temperature: 0.25 }),
  "température 0,5": withParams({ temperature: 0.5 }),
  "coût des cartes 0,04": withParams({ cardCost: 0.04 }),
  "coût des jokers 0,12": withParams({ jokerCost: 0.12 }),
  // The 1.2's simulations, and the same keeping `certain` (+simCertain=1, 12/10).
  "1.2 (stfig6)": rolloutPolicyOf(coreOf("stfig6")),
  "1.2 + certain (SimCertain)": rolloutPolicyOf({ ...coreOf("stfig6"), keepCertain: true }),
  // JokerWin (19/10, joker-win.js): a joker only where it wins the game.
  "1.2 JokerWin (stfig6jw)": rolloutPolicyOf(coreOf("stfig6jw")),
};
const MAX_CARDS = 9;
const SEEDS = [1, 2, 3];
const LIMIT = 400;
const source = new URL("../selfplay/experimental_80.json", import.meta.url);
const cache = new URL("../selfplay/policy-positions.json", import.meta.url);
const key = (move) => `${move.card}@${move.border}`;
const pct = (share) => `${(100 * share).toFixed(1).replace(".", ",")} %`;

/** The decisive endgames of game `index`: won for the mover, but not by every move. */
function positionsOf(log, index) {
  const found = [];
  for (let turn = 30; turn <= log.turns.length; turn += 1) {
    const state = stateAt(log, turn);
    const cards = state.hands[0].length + state.hands[1].length;
    if (state.over || state.pile.length > 0 || cards > MAX_CARDS || legalMoves(state).length < 2) continue;
    const solution = solveEndgame(state);
    const winning = bestMoves(solution).map(key);
    if (solution.value === 1 && winning.length < solution.moves.length) found.push({ index, turn, winning, moves: solution.moves.length });
  }
  return found;
}

/** The solved positions: from the cache, or solved now and cached. */
async function solvedPositions(logs) {
  const cached = await readFile(cache, "utf8").then(JSON.parse, () => null);
  if (cached) return cached;
  const found = [];
  for (const [index, log] of logs.entries()) {
    if (found.length >= LIMIT) break;
    found.push(...positionsOf(log, index));
  }
  await writeFile(cache, JSON.stringify(found));
  return found;
}

function score(policy, positions) {
  let kept = 0;
  for (const { state, winning } of positions) {
    for (const seed of SEEDS) if (winning.has(key(policy(createRng(seed)).choose(state, legalMoves(state))))) kept += 1;
  }
  return kept / Math.max(1, positions.length * SEEDS.length);
}

const started = performance.now();
const logs = JSON.parse(await readFile(source, "utf8"));
const positions = (await solvedPositions(logs)).map((p) => ({ ...p, state: stateAt(logs[p.index], p.turn), winning: new Set(p.winning) }));
const delicate = positions.filter((p) => p.winning.size * 2 <= p.moves);
console.log(`# Politique de simulation — ${positions.length} fins de partie décisives (${MAX_CARDS} cartes ou moins), dont ${delicate.length} délicates, ${SEEDS.length} graines\n`);
console.log("| Politique | Coup gagnant gardé | Sur les délicates |");
console.log("| --- | --- | --- |");
for (const [name, policy] of Object.entries(POLICIES)) console.log(`| ${name} | ${pct(score(policy, positions))} | ${pct(score(policy, delicate))} |`);
console.log(`\nDurée : ${((performance.now() - started) / 1000).toFixed(0)} s`);
