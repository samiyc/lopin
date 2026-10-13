import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stateAt } from "../../src/replay/log.js";
import { claimText } from "./cli-view.js";

/**
 * Positions whose best move is known, for the worked examples shown to a model
 * (`npm run llm-examples`, `npm run agent-examples`; Sami, 13/10). Two sources:
 * the oracle's clear choices (`oracle/positions*.jsonl`: its move taken by at
 * least 30 % of the visits and 15 points ahead of the runner-up, spread over
 * the game's phases) and the puzzles (`web/data/puzzles.json`: the solver's
 * winning move where the core's loses).
 */

/** The games of the duels directory, read once each. */
function gamesOf(duelsDir) {
  const files = new Map();
  return (file, game) => {
    if (!files.has(file)) files.set(file, JSON.parse(readFileSync(resolve(duelsDir, file), "utf8")));
    return files.get(file).games[game];
  };
}

/**
 * The oracle's clear choices, the same number in each third of the game (turns ≤ 12, 13-24, 25+).
 * `files`: the positions files (paths or URLs); `duels`: the directory their `file` fields name.
 */
export function oracleChoices({ files, duels, total }) {
  const gameOf = gamesOf(duels);
  const rows = files.flatMap((file) => readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)));
  const clear = rows.filter((row) => row.share >= 0.3 && row.share - (row.runnerUp ?? 0) >= 0.15 && row.move);
  const phases = [(turn) => turn <= 12, (turn) => turn > 12 && turn <= 24, (turn) => turn > 24];
  const picked = [];
  phases.forEach((inPhase, index) => {
    const pool = clear.filter((row) => inPhase(row.turn));
    const wanted = Math.round(((index + 1) * total) / 3) - Math.round((index * total) / 3);
    // Evenly through the file, so one duel does not supply them all.
    for (let k = 0; k < wanted && pool.length > 0; k += 1) picked.push(pool[Math.floor(((k + 0.5) * pool.length) / wanted)]);
  });
  return picked.flatMap((row) => {
    const log = gameOf(row.file, row.game);
    if (!log) return [];
    return [{ kind: "oracle", source: `oracle ${row.file} #${row.game} tour ${row.turn}`, log, turn: row.turn, state: stateAt(log, row.turn), label: row.move, share: row.share, runnerUp: row.runnerUp ?? 0 }];
  });
}

/** Puzzles whose core move loses: the solver's win (`label`), and the trap (`coreMove`). */
export function puzzleChoices({ file, total }) {
  const all = JSON.parse(readFileSync(file, "utf8"));
  const list = (Array.isArray(all) ? all : all.puzzles).filter((puzzle) => puzzle.coreFails && puzzle.solutions?.length > 0);
  const count = Math.min(total, list.length);
  const picked = Array.from({ length: count }, (_, k) => list[Math.floor(((k + 0.5) * list.length) / count)]);
  return picked.map((puzzle) => ({ kind: "puzzle", source: `puzzle #${puzzle.id}`, log: puzzle.log, turn: puzzle.turn, state: stateAt(puzzle.log, puzzle.turn), label: puzzle.solutions[0], coreMove: puzzle.coreMove ?? null }));
}

/** « 9♦→7 » as the CLI's input « 9♦ 7 ». */
export const inputOf = (label) => label.replace("→", " ");

const moveText = (entry) => (entry.pass ? "passe" : `${entry.move.card} → borne ${entry.move.border}`);
const ownersOf = (state) => state.borders.map((border) => border.owner);

/** The borders owned in `to` that were not in `from`, as `claimText` reads them. */
const claimedBetween = (from, to) => to.flatMap((owner, index) => (owner !== null && owner !== undefined && owner !== from[index] ? [{ index, owner }] : []));

/**
 * What the CLI's `dernier_echange` would have said at logged turn `turn`: the mover's previous move, the
 * opponent's answer, and the claims they brought (`{ toi, robot, revendications }`, as `jsonView` reads it).
 */
export function exchangeBefore(log, turn, me) {
  const mine = log.turns[turn - 3];
  const theirs = log.turns[turn - 2];
  const known = mine?.player === me && theirs?.player === 1 - me;
  if (!known) return { toi: null, robot: null, revendications: [] };
  const [start, middle, end] = [turn - 2, turn - 1, turn].map((at) => ownersOf(stateAt(log, at)));
  const revendications = [claimedBetween(start, middle), claimedBetween(middle, end)].filter((news) => news.length > 0).map((news) => claimText(news, me));
  return { toi: moveText(mine), robot: moveText(theirs), revendications };
}
