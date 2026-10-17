import { readFileSync } from "node:fs";
import { BOT_IDS, BOT_LINEUP, botTag, engineOf } from "../src/config/bots.js";
import { OFFICIAL_RULES } from "../src/config/rules.js";
import { DUEL_ROW, SEED } from "../src/config/simulations.js";
import { BOTS, engineFor } from "../src/sim/bots.js";
import { PROFILES, duelVerdict, isSlowEngine, pointsOf } from "./lib/domain/duel-plan.js";
import { saveDuel, shouldSave } from "./lib/domain/duel-save.js";
import { runPool, workerCount } from "./lib/cli/pool.js";

/**
 * `npm run duel -- <bot A> <bot B> [--quick | --screen | --long] [--games N] [--page]`:
 * A against B on the recommended rules, from both seats, on every core. Prints
 * A's win rate with its 95 % interval, round after round, and stops as soon as
 * the result is clear (`scripts/lib/domain/duel-plan.js`). `--quick` (the default)
 * sorts ideas in 5 minutes at most, `--screen` in 10; `--long` decides a
 * version in 20 at most; `--games N` plays exactly N games a seat, however
 * long it takes.
 *
 * The interval is the paired one: every deck is played from both seats, and
 * the pair is the unit of measure. Wilson's, game by game, is printed beside
 * it for comparison.
 *
 * `--hands weak|strong` deals only decks whose first player starts with a
 * weak or a strong hand (src/sim/eval/hand-classes.js), the same for both seats.
 *
 * The games are kept as replays in duels/ (`--save`, and by default for a
 * long duel or bots at full strength: `scripts/lib/domain/duel-save.js`).
 *
 * Borders settle as soon as they are full (`early`), the rule every Elo line
 * was measured with. `--page` plays the page's own rule instead
 * (`OFFICIAL_RULES.endMode`, claimed as soon as proved): slower, since every
 * move proves what it can, but it is the game people actually play.
 *
 * Bots are line-up ids (`src/config/bots.js`) or engine ids (`BOTS` in
 * `src/sim/bots.js`, and `experimental:N` for N rollouts a move). Any
 * experimental engine takes `@N` for a budget of N rollouts: `experimental:0.6@200`.
 *
 *   npm run duel -- idea:middle strategist
 *   npm run duel -- experimental:400 stratege --long
 */
const args = process.argv.slice(2);
// A flag's value (`--hands weak`, `--pool file`) is not a bot.
const flagValue = (i) => i > 0 && ["--hands", "--pool"].includes(args[i - 1]);
const [a = "experimental", b = "stratege"] = args.filter((arg, i) => !arg.startsWith("--") && !/^\d+$/.test(arg) && !flagValue(i));
const valueOf = (flag) => (args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) : 0);
const exact = valueOf("--games") || null;
// `--offset K` deals other decks (and seeds the bots otherwise): a second run to pool with the first.
const offset = valueOf("--offset");
const base = SEED + 1_000_003 * offset;
const offsetNote = offset ? ` (donnes décalées de ${offset})` : "";
const profileName = ["long", "screen"].find((name) => args.includes(`--${name}`)) ?? "quick";
const profile = PROFILES[profileName];
const profileLabel = exact ? `${exact} parties` : profileName;
const endMode = args.includes("--page") ? OFFICIAL_RULES.endMode : "early";
// `--hands weak|strong`: every deck gives the first player a hand of that class (src/sim/eval/hand-classes.js).
const handClass = args.includes("--hands") ? args[args.indexOf("--hands") + 1] : null;
const HAND_LABELS = { weak: "faibles", strong: "fortes" };
const handsNote = handClass ? `, mains ${HAND_LABELS[handClass]} au 1er joueur` : "";
const openHands = args.includes("--open") || args.includes("--reveal-hands");
const openNote = openHands ? ", mains révélées" : "";
// `--pool file` (npm run deals -- --pool): the duel plays those deals, in order, from both seats, instead of fresh ones.
const poolFile = args.includes("--pool") ? args[args.indexOf("--pool") + 1] : null;
// A pool holds seeds (npm run deals) or decks (npm run deal-pool, from the kept duels).
const poolData = poolFile ? JSON.parse(readFileSync(poolFile, "utf8")) : null;
const pool = poolData ? (poolData.seeds ?? poolData.decks) : null;
const poolNote = pool ? `, pool ${poolFile} (${pool.length} donnes)` : "";

const engine = (id) => (id in BOT_LINEUP ? engineOf(id) : id);
const tag = (id) => (id in BOT_LINEUP ? botTag(id) : id);
const known = (id) => {
  try {
    return Boolean(engineFor(engine(id)));
  } catch {
    return false;
  }
};
if (!known(a) || !known(b)) {
  process.stderr.write(`Usage : npm run duel -- <robot> <robot> [--quick | --long] [--games N]\n  robots : ${BOT_IDS.join(", ")}, ${Object.keys(BOTS).join(", ")}, experimental:N\n`);
  process.exit(1);
}

const slow = isSlowEngine(engine(a)) || isSlowEngine(engine(b));
const save = shouldSave({ asked: args.includes("--save"), profileName, engines: [engine(a), engine(b)] });
const logs = [];
const scale = slow ? profile.slow : profile.fast;
const planned = exact ? { min: exact, max: exact, chunk: Math.max(1, Math.ceil(exact / 20)) } : scale;
// A pool holds so many deals: the duel stops there.
const plan = pool ? { ...planned, min: Math.min(planned.min, pool.length), max: Math.min(planned.max, pool.length) } : planned;
const threads = Math.max(2, workerCount());
const pct = (share) => `${(100 * share).toFixed(1).replace(".", ",")} %`;

const tally = { games: 0, first: 0, second: 0, tasks: 0, pairs: [] };

/** Game g of first-seat task t and game g of second-seat task t were dealt the same deck. */
function collectPairs(results, tasksPerSeat) {
  for (let t = 0; t < tasksPerSeat; t += 1) {
    const [asFirst, asSecond] = [results[t].winners, results[tasksPerSeat + t].winners];
    asFirst.forEach((winner, g) => tally.pairs.push((pointsOf(winner, 0) + pointsOf(asSecond[g], 1)) / 2));
  }
}
const started = Date.now();
let verdict = { stop: false };
let lastRound = 0;
while (!verdict.stop) {
  const roundStarted = Date.now();
  const perSeat = Math.min(plan.max - tally.games, Math.max(plan.chunk, Math.ceil(threads / 2) * plan.chunk));
  const tasksPerSeat = Math.ceil(perSeat / plan.chunk);
  const tasks = [];
  // Both seatings play the same decks (`deals`): the luck of the cards cancels out.
  const round = tally.tasks;
  for (const [players, labels] of [[[engine(a), engine(b)], [tag(a), tag(b)]], [[engine(b), engine(a)], [tag(b), tag(a)]]]) {
    for (let t = 0; t < tasksPerSeat; t += 1) {
      tally.tasks += 1;
      const games = Math.min(plan.chunk, perSeat - t * plan.chunk);
      const from = tally.games + t * plan.chunk;
      tasks.push({ ...DUEL_ROW, endMode, handClass, openHands, keepWinners: true, keepLogs: save, labels, players, games, seed: base + 104729 * tally.tasks, deals: base + 7 * 104729 * (round + t), dealSeeds: pool?.slice(from, from + games) });
    }
  }
  const results = await runPool(new URL("./lib/workers/sim-worker.js", import.meta.url), tasks);
  results.forEach((result, i) => {
    if (i < tasksPerSeat) tally.first += result.wins[0];
    else tally.second += result.wins[1];
  });
  collectPairs(results, tasksPerSeat);
  if (save) results.forEach((result) => logs.push(...result.logs));
  tally.games += perSeat;
  lastRound = Date.now() - roundStarted;
  // Stop when another round like the last one would not fit: the cap holds, rounds are minutes long.
  const outOfTime = !exact && Date.now() - started + lastRound > profile.seconds * 1000;
  verdict = duelVerdict({ wins: tally.first + tally.second, games: tally.games, min: plan.min, max: plan.max, outOfTime, pairs: tally.pairs });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  process.stderr.write(`  ${2 * tally.games} parties, ${a} ${pct((tally.first + tally.second) / (2 * tally.games))} (${pct(verdict.low)} – ${pct(verdict.high)}), ${seconds} s\n`);
}

const share = (tally.first + tally.second) / (2 * tally.games);

/** n, mean and standard deviation of the pair scores: what pooling two runs needs. */
function pairStats(pairs) {
  const mean = pairs.reduce((sum, p) => sum + p, 0) / pairs.length;
  const sd = Math.sqrt(pairs.reduce((sum, p) => sum + (p - mean) ** 2, 0) / Math.max(1, pairs.length - 1));
  return `n = ${pairs.length}, moyenne ${mean.toFixed(4)}, écart-type ${sd.toFixed(4)}`;
}
function conclusion() {
  if (verdict.low > 0.5) return `  → ${a} est nettement meilleur.`;
  if (verdict.high < 0.5) return `  → ${b} est nettement meilleur.`;
  return "  → pas de différence nette.";
}
process.stdout.write(
  [
    `${tag(a)} contre ${tag(b)} — ${2 * tally.games} parties (${tally.games} de chaque côté), règle ${endMode}${handsNote}${openNote}${poolNote}, profil ${profileLabel}, ${((Date.now() - started) / 1000).toFixed(1)} s`,
    `  ${a} gagne ${pct(share)}  (fourchette à 95 % par paires : ${pct(verdict.low)} – ${pct(verdict.high)} ; partie par partie : ${pct(verdict.wilson[0])} – ${pct(verdict.wilson[1])})`,
    `  en commençant : ${pct(tally.first / tally.games)} · en second : ${pct(tally.second / tally.games)}`,
    `  paires : ${pairStats(tally.pairs)}${offsetNote}`,
    conclusion(),
    save ? await saveDuel({ a: tag(a), b: tag(b), engines: [engine(a), engine(b)], settings: { endMode, handClass, openHands, offset, profile: profileLabel, ...(poolFile ? { pool: poolFile } : {}) }, logs }) : "  (parties non gardées : --save pour les garder)",
    "",
  ].join("\n"),
);
