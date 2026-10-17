import { writeFile } from "node:fs/promises";
import { replayStates, rulesOf } from "../src/replay/core/log.js";
import { jokerTraits, pairWithJoker } from "../src/replay/oracle/joker-features.js";
import { parseCards } from "../src/core/notation.js";
import { jokersOf as jokersHeld } from "../src/replay/core/jokers-held.js";
import { readAllLogs } from "./lib/domain/elo-data.js";
import { loadGame, readIndex } from "./lib/domain/game-index.js";

/**
 * `npm run jokers`: where the jokers of the kept bot games (duels/) went, and
 * what came of it (Sami, 02/10). Each joker put is read by `jokerTraits`
 * (src/replay/oracle/joker-features.js), alone and two by two (what it joins × what
 * faces it, × the border). For each: how many, how often its player won the
 * border it went on, and the game.
 *
 * Between bots of equal strength a game is won half the time: a placement
 * whose player wins 70 % of the time or more is one winners make and losers
 * do not — Sami's reading of "true in 80 % of the games".
 */
const MIN_COUNT = 60;

/** A player's points in a game: 1, ½ for a draw, 0. */
const pointsOf = (winner, seat) => (winner === null ? 0.5 : Number(winner === seat));

/** One record per player and game: the jokers they got (all game, starting hand), the split, and their points. */
const luckOf = (jokers, winner, seat) => ({ total: jokers.total[seat], start: jokers.start[seat], split: `${jokers.total[seat]} contre ${jokers.total[1 - seat]}`, points: pointsOf(winner, seat) });

function luckLines(records, key, values) {
  for (const value of values) {
    const rows = records.filter((record) => record[key] === value);
    if (rows.length === 0) continue;
    const mean = rows.reduce((sum, record) => sum + record.points, 0) / rows.length;
    console.log(`    ${String(value).padEnd(11)} ${pct(mean)} de victoires  (${rows.length})`);
  }
}

/** Win rate by jokers got: in the whole game, in the starting hand, and by how the two jokers were shared. */
function reportLuck(title, records) {
  console.log(`
=== ${title}`);
  console.log("  jokers obtenus dans la partie (main de départ et pioche) :");
  luckLines(records, "total", [0, 1, 2]);
  console.log("  jokers dans la main de départ :");
  luckLines(records, "start", [0, 1, 2]);
  console.log("  partage des deux jokers, le joueur contre l'adversaire :");
  luckLines(records, "split", ["2 contre 0", "1 contre 0", "1 contre 1", "0 contre 0", "0 contre 1", "0 contre 2"]);
}

/** Sami's games against the bots: his side only. */
async function humanRecords() {
  const logs = await readAllLogs();
  return logs.flatMap((log) => {
    const seat = log.players.findIndex((player) => player.kind === "human");
    if (seat < 0 || !log.result || log.result.winner === undefined) return [];
    return [luckOf(jokersHeld(log), log.result.winner, seat)];
  });
}
const WEAK_BOTS = /^(basique|stratege)@/;

/** Every joker put in a game: its traits, whether its player won that border and the game. */
function jokersOf(log) {
  const { spec } = rulesOf(log.rules);
  const frames = replayStates(log);
  const winners = new Map(log.result.borders.map((entry) => [entry.border - 1, entry.winner]));
  return frames.slice(1).flatMap(({ entry }, i) => {
    if (!entry || entry.pass || !entry.joker) return [];
    const border = entry.move.border - 1;
    const traits = jokerTraits({ ...frames[i].state, spec }, entry.player, border, entry.turn);
    const borderWinner = winners.get(border);
    return [{ traits, game: log.result.winner === entry.player, border: borderWinner === undefined || borderWinner === null ? null : borderWinner === entry.player }];
  });
}

/** Every pair built with a joker in hand: dead or not, finished by a joker, and what came of the border and the game. */
function trapsOf(log) {
  const { spec } = rulesOf(log.rules);
  const frames = replayStates(log);
  const winners = new Map(log.result.borders.map((entry) => [entry.border - 1, entry.winner]));
  return frames.slice(1).flatMap(({ entry }, i) => {
    if (!entry || entry.pass || entry.joker) return [];
    const move = { card: parseCards(spec, [entry.move.card])[0], border: entry.move.border - 1 };
    const pair = pairWithJoker({ ...frames[i].state, spec }, entry.player, parseCards(spec, entry.hand), move);
    if (!pair) return [];
    const later = log.turns.slice(i + 1).some((next) => next.player === entry.player && next.joker && next.move.border === entry.move.border);
    const borderWinner = winners.get(move.border);
    return [{ dead: pair.dead, joker: later, border: borderWinner === undefined || borderWinner === null ? null : borderWinner === entry.player, game: log.result.winner === entry.player }];
  });
}

function reportTraps(traps) {
  console.log("\n=== Le piège : une paire posée avec un joker en main");
  console.log("  paires  finies au joker  borne gagnée  partie gagnée");
  for (const [label, rows] of [["paire morte (les 2 autres cartes déjà en jeu)", traps.filter((trap) => trap.dead)], ["paire vivante", traps.filter((trap) => !trap.dead)]]) {
    const decided = rows.filter((row) => row.border !== null);
    const share = (list, test) => pct(list.length ? list.filter(test).length / list.length : null);
    console.log(`  ${String(rows.length).padStart(6)}  ${share(rows, (row) => row.joker)}           ${share(decided, (row) => row.border)}        ${share(rows, (row) => row.game)}   ${label}`);
  }
}

/** The traits alone, and crossed: what the joker joins with what faces it, and with the border. */
const keysOf = ([mine, theirs, border, phase]) => [mine, theirs, border, phase, `${mine} · ${theirs}`, `${mine} · ${border}`, `${theirs} · ${border}`];

function addJoker(stats, key, joker) {
  const stat = stats.get(key) ?? { count: 0, games: 0, decided: 0, borders: 0 };
  stat.count += 1;
  stat.games += joker.game ? 1 : 0;
  stat.decided += joker.border === null ? 0 : 1;
  stat.borders += joker.border ? 1 : 0;
  stats.set(key, stat);
}

function tally(jokers) {
  const stats = new Map();
  for (const joker of jokers) for (const key of keysOf(joker.traits)) addJoker(stats, key, joker);
  return [...stats].map(([key, s]) => ({ key, count: s.count, game: s.games / s.count, border: s.decided ? s.borders / s.decided : null, decided: s.decided }));
}

const pct = (x) => (x === null ? "  —" : `${String(Math.round(100 * x)).padStart(3)} %`);

function report(title, rows) {
  console.log(`\n=== ${title}`);
  console.log("  partie  borne   jokers  placement");
  rows
    .filter((row) => row.count >= MIN_COUNT)
    .sort((a, b) => b.game - a.game)
    .forEach((row) => console.log(`  ${pct(row.game)}  ${pct(row.border)}  ${String(row.count).padStart(6)}  ${row.key}`));
}

const rows = (await readIndex()).filter((row) => row.winner === 0 || row.winner === 1);
const equal = rows.filter((row) => !row.players.some((player) => WEAK_BOTS.test(player)));
const jokers = [];
const traps = [];
for (const row of equal) {
  const log = await loadGame(row);
  jokers.push(...jokersOf(log));
  traps.push(...trapsOf(log));
}
const stats = tally(jokers);
report(`Jokers posés entre robots de même force : ${jokers.length}, dans ${equal.length} parties (au moins ${MIN_COUNT} par ligne)`, stats);
reportTraps(traps);
const allRows = (await readIndex()).filter((row) => row.jokers && row.winner !== undefined);
const equalRows = allRows.filter((row) => !row.players.some((player) => WEAK_BOTS.test(player)));
reportLuck(`La chance des jokers, robots de même force (${equalRows.length} parties)`, equalRows.flatMap((row) => [0, 1].map((seat) => luckOf(row.jokers, row.winner, seat))));
const humans = await humanRecords();
reportLuck(`La chance des jokers, Sami contre les robots (${humans.length} parties, son côté)`, humans);
await writeFile(new URL("../data/jokers-mining.json", import.meta.url), `${JSON.stringify({ built: new Date().toISOString().slice(0, 10), games: equal.length, jokers: jokers.length, stats }, null, 1)}\n`);
