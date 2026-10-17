import { writeFile } from "node:fs/promises";
import { replayStates, rulesOf } from "../src/replay/core/log.js";
import { contextsOf, loggedMove, traitsOf } from "../src/replay/oracle/move-features.js";
import { loadGame, readIndex } from "./lib/domain/game-index.js";

/**
 * `npm run rules -- [--min 0.7]`: rules mined from the kept bot games
 * (duels/), for new bonuses of the core (Sami, 02/10). Every move is read as
 * a moment (`contextsOf`) and what it did (`traitsOf`,
 * src/replay/oracle/move-features.js); per game and player, each trait gets its
 * share of the moves played in each moment. Two readings:
 *
 * - paired: in the same game, does the winner do it more often than the
 *   loser? The deck is the same for both, so its luck mostly cancels out;
 * - per game: is it true (at least once, or on most moves of the moment) in
 *   X % of the games won against Y % of the games lost?
 *
 * Games between bots of equal strength (both searching) and between unequal
 * ones are kept apart: in the second, the winner is mostly the stronger bot,
 * and the rules describe its style rather than what wins.
 *
 * A rule is a correlation, not a cause: being ahead makes some moves more
 * frequent. A candidate becomes a bonus only after a core-against-core duel.
 */
const args = process.argv.slice(2);
const MIN = args.includes("--min") ? Number(args[args.indexOf("--min") + 1]) : 0.7;
const MIN_MOVES = 2;
const WEAK_BOTS = /^(basique|stratege)@/;

/** Per player: moves counted in each moment, and the traits among them. */
function tallyGame(log, handClasses) {
  const { spec } = rulesOf(log.rules);
  const tallies = [new Map(), new Map()];
  const frames = replayStates(log);
  frames.slice(1).forEach(({ entry }, i) => {
    if (!entry || entry.pass) return;
    const state = { ...frames[i].state, spec };
    const { move, hand } = loggedMove(spec, entry);
    const traits = traitsOf(state, entry.player, hand, move);
    for (const context of contextsOf(state, entry.player, handClasses[entry.player], entry.turn)) {
      const slot = tallies[entry.player].get(context) ?? { moves: 0, traits: new Map() };
      slot.moves += 1;
      traits.forEach((trait) => slot.traits.set(trait, (slot.traits.get(trait) ?? 0) + 1));
      tallies[entry.player].set(context, slot);
    }
  });
  return tallies;
}

const rateOf = (tally, context, trait) => {
  const slot = tally.get(context);
  return slot && slot.moves >= MIN_MOVES ? (slot.traits.get(trait) ?? 0) / slot.moves : null;
};

/** Every (moment, trait) seen in a game. */
function pairsOf(tallies) {
  const keys = new Set();
  for (const tally of tallies) for (const [context, slot] of tally) for (const trait of slot.traits.keys()) keys.add(`${context}|${trait}`);
  return keys;
}

function addRates(stats, key, winner, loser) {
  const stat = stats.get(key) ?? { more: 0, less: 0, both: 0, anyWin: 0, anyLoss: 0, mostWin: 0, mostLoss: 0, rateWin: 0, rateLoss: 0 };
  stat.both += 1;
  if (winner > loser) stat.more += 1;
  if (winner < loser) stat.less += 1;
  stat.anyWin += winner > 0 ? 1 : 0;
  stat.anyLoss += loser > 0 ? 1 : 0;
  stat.mostWin += winner >= 0.5 ? 1 : 0;
  stat.mostLoss += loser >= 0.5 ? 1 : 0;
  stat.rateWin += winner;
  stat.rateLoss += loser;
  stats.set(key, stat);
}

/** Moves with each (moment, trait), played by the game's winner and by its loser. */
function addMoves(moves, win, loss) {
  for (const [side, tally] of [["win", win], ["loss", loss]]) {
    for (const [context, slot] of tally) {
      for (const [trait, count] of slot.traits) {
        const entry = moves.get(`${context}|${trait}`) ?? { win: 0, loss: 0 };
        entry[side] += count;
        moves.set(`${context}|${trait}`, entry);
      }
    }
  }
}

async function mine(rows) {
  const stats = new Map();
  const moves = new Map();
  for (const row of rows) {
    const tallies = tallyGame(await loadGame(row), row.handClasses);
    const [win, loss] = [tallies[row.winner], tallies[1 - row.winner]];
    addMoves(moves, win, loss);
    for (const key of pairsOf(tallies)) {
      const [context, trait] = key.split("|");
      const [winner, loser] = [rateOf(win, context, trait), rateOf(loss, context, trait)];
      if (winner !== null && loser !== null) addRates(stats, key, winner, loser);
    }
  }
  return [...stats].map(([key, s]) => {
    const [context, trait] = key.split("|");
    const decided = s.more + s.less;
    const played = moves.get(key);
    return {
      moves: played.win + played.loss,
      precision: played.win / (played.win + played.loss),
      context,
      trait,
      games: s.both,
      winnerMore: decided ? s.more / decided : 0.5,
      rate: [s.rateWin / s.both, s.rateLoss / s.both],
      any: [s.anyWin / s.both, s.anyLoss / s.both],
      most: [s.mostWin / s.both, s.mostLoss / s.both],
    };
  });
}

const pct = (x) => `${Math.round(100 * x)} %`;
const enough = (rule) => rule.games >= 100;

function report(title, rules) {
  console.log(`\n=== ${title}`);
  console.log(`— Le gagnant le fait plus (ou moins) souvent que le perdant, dans au moins ${pct(MIN)} des parties où ils diffèrent :`);
  rules
    .filter((rule) => enough(rule) && (rule.winnerMore >= MIN || rule.winnerMore <= 1 - MIN))
    .sort((a, b) => Math.abs(b.winnerMore - 0.5) - Math.abs(a.winnerMore - 0.5))
    .slice(0, 25)
    .forEach((rule) => console.log(`  ${rule.winnerMore >= 0.5 ? "plus " : "moins"} ${pct(Math.max(rule.winnerMore, 1 - rule.winnerMore))}  ${rule.context} → ${rule.trait}  (part des coups : ${pct(rule.rate[0])} contre ${pct(rule.rate[1])}, ${rule.games} parties)`));
  console.log(`— Vrai dans au moins ${pct(MIN)} des parties gagnées ou perdues, avec 15 points d'écart :`);
  const binary = rules.flatMap((rule) => [
    { ...rule, how: "au moins une fois", split: rule.any },
    { ...rule, how: "sur la plupart de ses coups", split: rule.most },
  ]);
  binary
    .filter((rule) => enough(rule) && Math.max(...rule.split) >= MIN && Math.abs(rule.split[0] - rule.split[1]) >= 0.15)
    .sort((a, b) => Math.abs(b.split[0] - b.split[1]) - Math.abs(a.split[0] - a.split[1]))
    .slice(0, 25)
    .forEach((rule) => console.log(`  gagnées ${pct(rule.split[0])} / perdues ${pct(rule.split[1])}  ${rule.context} → ${rule.trait}, ${rule.how}  (${rule.games} parties)`));
}

const started = Date.now();
const rows = (await readIndex()).filter((row) => row.winner === 0 || row.winner === 1);
const unequal = (row) => row.players.some((player) => WEAK_BOTS.test(player)) && !row.players.every((player) => WEAK_BOTS.test(player));
const groups = { equal: rows.filter((row) => !row.players.some((player) => WEAK_BOTS.test(player))), unequal: rows.filter(unequal) };
const results = {};
for (const [name, group] of Object.entries(groups)) results[name] = { games: group.length, rules: await mine(group) };
report(`Robots de même force (${groups.equal.length} parties)`, results.equal.rules);
report(`Robots de force inégale (${groups.unequal.length} parties : le gagnant est surtout le plus fort)`, results.unequal.rules);
await writeFile(new URL("../data/rules-mining.json", import.meta.url), `${JSON.stringify({ built: new Date().toISOString().slice(0, 10), min: MIN, ...results }, null, 1)}\n`);
console.log(`\n${((Date.now() - started) / 1000).toFixed(0)} s → data/rules-mining.json`);
