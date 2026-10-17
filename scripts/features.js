import { writeFile } from "node:fs/promises";
import { Session } from "node:inspector";
import { OFFICIAL_RULES } from "../src/config/rules.js";
import { createRng } from "../src/core/random.js";
import { rulesOf } from "../src/replay/core/log.js";
import { engineFor, rolloutPolicyOf, strategistBot } from "../src/sim/bots.js";
import { coreOf } from "../src/sim/heuristics/experimental.js";
import { applyMove, createGame, legalMoves } from "../src/sim/engine/game.js";
import { cloneState } from "../src/sim/search/lookahead.js";
import { ABLATIONS, FAMILIES, FEATURES, compareScorings, timeByFeature } from "./lib/domain/core-features.js";

/**
 * `npm run features -- [--games 40] [--budget 300] [--core v1nc]`: what each feature of the
 * 1.0's core costs and how often it acts (Sami, 05/10: which cost the most and
 * serve the least, to try variations or remove them). On one thread, on
 * positions of games the core plays against itself (every other turn):
 *
 * - time: a CPU profile (node:inspector, sampled every 100 µs) of three
 *   workloads — the core as the rollouts call it (without `certain`), the
 *   core at the root (with it), and a whole tree search of the 1.0 — each
 *   function's self time given to its feature (scripts/lib/domain/core-features.js);
 * - activation: each feature switched off in turn, the same moves scored
 *   again — how many gains change, and how often the favourite does.
 *
 * Results in data/core-features.json, which the changelog plots (another core,
 * `--core`, goes to data/core-features-<core>.json). Run it on a
 * quiet machine: the shares hold under load, the milliseconds do not.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const GAMES = option("--games", 40);
const BUDGET = option("--budget", 300);
const CORE = args.includes("--core") ? args[args.indexOf("--core") + 1] : "stfig6";
const OUT = CORE === "stfig6" ? "core-features.json" : `core-features-${CORE}.json`;
// The rollout core scores all moves in a fraction of a millisecond: repeated, for enough samples.
const REPEATS = 10;
const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
const pct = (x) => `${(100 * x).toFixed(1).replace(".", ",")} %`;

/** Positions of games the core plays against itself, every other turn, with more than one move to choose from. */
function positions(games) {
  const states = [];
  for (let seed = 1; seed <= games; seed += 1) {
    const rng = createRng(seed);
    const players = [0, 1].map(() => rolloutPolicyOf(coreOf(CORE))(rng));
    const state = createGame(spec, { order, jokerRule, endMode, rng });
    while (!state.over) {
      const moves = legalMoves(state);
      if (state.turn % 2 === 0 && moves.length > 1) states.push(cloneState(state));
      applyMove(state, moves.length > 0 ? players[state.current].choose(state, moves) : null);
    }
  }
  return states;
}

const post = (session, method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => (error ? reject(error) : resolve(result))));

/** The CPU profile of `work`, as self time per feature. */
async function profiled(work) {
  const session = new Session();
  session.connect();
  await post(session, "Profiler.enable");
  await post(session, "Profiler.setSamplingInterval", { interval: 100 });
  await post(session, "Profiler.start");
  const started = performance.now();
  work();
  const wall = performance.now() - started;
  const { profile } = await post(session, "Profiler.stop");
  session.disconnect();
  return { wall, ...timeByFeature(profile) };
}

/** How often switching each feature off changes a gain, and the favourite, over `states`. */
function activation(settings, states, ablations) {
  const score = (core, state) => strategistBot(createRng(1), core).scoreMoves(state, legalMoves(state), { keepAll: true });
  return Object.fromEntries(
    ablations.map((id) => {
      const off = ABLATIONS[id](settings);
      const tally = { moves: 0, changed: 0, positions: 0, favourite: 0 };
      for (const state of states) {
        const { moves, changed, favourite } = compareScorings(score(settings, state), score(off, state));
        Object.assign(tally, { moves: tally.moves + moves, changed: tally.changed + changed, positions: tally.positions + 1, favourite: tally.favourite + Number(favourite) });
      }
      return [id, { moves: tally.changed / tally.moves, favourite: tally.favourite / tally.positions }];
    }),
  );
}

const rolloutCore = { ...coreOf(CORE), ideas: coreOf(CORE).ideas.filter((idea) => idea !== "certain") };
const rootCore = coreOf(CORE);
const states = positions(GAMES);
const searched = states.filter((_, i) => i % 4 === 0);
console.log(`# Les features du cœur du 1.0 (${CORE}) — ${states.length} positions de ${GAMES} parties, ${searched.length} recherches à ${BUDGET} itérations\n`);

const policy = strategistBot(createRng(1), rolloutCore);
const root = strategistBot(createRng(1), rootCore);
const tree = engineFor(`ismcts+widen=3+depth=5+core=${CORE}@${BUDGET}`)(createRng(1));
const time = {
  rollout: await profiled(() => {
    for (let r = 0; r < REPEATS; r += 1) for (const state of states) policy.scoreMoves(state, legalMoves(state));
  }),
  root: await profiled(() => {
    for (let r = 0; r < REPEATS / 2; r += 1) for (const state of states) root.scoreMoves(state, legalMoves(state));
  }),
  iteration: await profiled(() => {
    for (const state of searched) tree.scoreMoves(state, legalMoves(state));
  }),
};
const rolloutIds = Object.keys(ABLATIONS).filter((id) => id !== "certain");
const acting = { rollout: activation(rolloutCore, states, rolloutIds), root: activation(rootCore, states, Object.keys(ABLATIONS)) };

console.log("| Feature | Simulations : temps | à la racine : temps | une itération : temps | gains changés | favori changé |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const { id, label } of FEATURES) {
  const share = (scope) => (time[scope].features[id] ? pct(time[scope].features[id].share) : "—");
  const act = acting.root[id];
  console.log(`| ${label} | ${share("rollout")} | ${share("root")} | ${share("iteration")} | ${act ? pct(act.moves) : "toujours"} | ${act ? pct(act.favourite) : "—"} |`);
}
const perScoring = time.rollout.wall / (REPEATS * states.length);
console.log(`\nUne évaluation de tous les coups par le cœur des simulations : ${perScoring.toFixed(3)} ms ; une recherche à ${BUDGET} : ${(time.iteration.wall / searched.length).toFixed(0)} ms.`);

const scope = ({ wall, total, features }) => ({ wallMs: Math.round(wall), profiledMs: Math.round(total), features });
const report = {
  note: "npm run features : le temps de chaque feature du cœur du 1.0 (profil CPU, temps propre par fonction) et son activation (la feature éteinte, les mêmes coups notés à nouveau). Lu par le changelog.",
  built: new Date().toISOString().slice(0, 16),
  core: CORE,
  positions: states.length,
  searches: searched.length,
  budget: BUDGET,
  perScoringMs: Number(perScoring.toFixed(4)),
  families: FAMILIES,
  features: FEATURES.map(({ id, label, family }) => ({ id, label, family })),
  time: { rollout: scope(time.rollout), root: scope(time.root), iteration: scope(time.iteration) },
  activation: acting,
};
await writeFile(new URL(`../data/${OUT}`, import.meta.url), `${JSON.stringify(report, null, 1)}\n`);
console.log(`→ data/${OUT}`);
