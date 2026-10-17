import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { analyseGame, gameKey } from "../../../src/replay/core/game-analysis.js";
import { jokersOf } from "../../../src/replay/core/jokers-held.js";
import { shortTag } from "../../../src/config/bots.js";

/**
 * The index of the bot games kept in duels/ (`index.json`): one row per game,
 * with its key, where it is, who played and won, and its analysis
 * (`src/replay/core/game-analysis.js`). Games are picked from the index without
 * reading them (`npm run games`), then loaded one file at a time.
 */
export const DUELS_DIR = fileURLToPath(new URL("../../../duels/", import.meta.url));
const INDEX = `${DUELS_DIR}index.json`;

/** The index row of game `game` of `file`. */
export function rowOf(file, game, log) {
  const analysis = log.analysis?.columns ? log.analysis : analyseGame(log);
  return {
    key: gameKey(log),
    file,
    game,
    players: log.players.map((player) => shortTag(player.version)),
    engines: log.players.map((player) => player.bot),
    endMode: log.rules.endMode,
    turns: log.turns.length,
    winner: log.result.winner,
    ...analysis,
    // Older games were saved before the jokers were counted: counted here from the log.
    jokers: analysis.jokers ?? jokersOf(log),
  };
}

const duelFiles = async () => (await readdir(DUELS_DIR).catch(() => [])).filter((name) => name.endsWith(".json") && name !== "index.json");

/** Every row, rebuilt from the duel files (and their analysis computed where an older file lacks it). */
export async function rebuildIndex() {
  const rows = [];
  for (const file of await duelFiles()) {
    const duel = JSON.parse(await readFile(`${DUELS_DIR}${file}`, "utf8"));
    duel.games.forEach((log, game) => rows.push(rowOf(file, game, log)));
  }
  await writeIndex(rows);
  return rows;
}

/** The index, rebuilt when missing. */
export async function readIndex() {
  try {
    return JSON.parse(await readFile(INDEX, "utf8"));
  } catch {
    return rebuildIndex();
  }
}

export const writeIndex = (rows) => writeFile(INDEX, JSON.stringify(rows));

const files = new Map();

/** The logged game a row points to (each file read once). */
export async function loadGame({ file, game }) {
  if (!files.has(file)) files.set(file, JSON.parse(await readFile(`${DUELS_DIR}${file}`, "utf8")));
  return files.get(file).games[game];
}

/** Which seat a player label (`experimental@0.9`) sat in, or -1. */
const seatOf = (row, player) => row.players.indexOf(player);

/** The rows matching `filters`: `{ lostBy, wonBy, hands, balanced }` (hands: the class of `lostBy`'s or `wonBy`'s starting hand). */
export function filterRows(rows, { lostBy = null, wonBy = null, hands = null, balanced = false } = {}) {
  const who = lostBy ?? wonBy;
  const result = (row, seat) => {
    if (lostBy) return row.winner === 1 - seat;
    return !wonBy || row.winner === seat;
  };
  return rows.filter((row) => {
    const seat = who ? seatOf(row, who) : 0;
    if (seat === -1 || !result(row, seat)) return false;
    if (hands && row.handClasses[seat] !== hands) return false;
    return !balanced || row.handClasses.every((kind) => kind === "medium");
  });
}

/**
 * The turn to restart a row's game from (`stateAt(log, turn)`: before that
 * move): `first-border`, the move that won the first border; `columns`, the
 * move that put the first player on all seven borders; or a number.
 */
export function startTurn(row, from) {
  if (from === "first-border") return row.firstBorder?.turn ?? null;
  if (from === "columns") {
    const known = row.columns.filter((turn) => turn !== null);
    return known.length > 0 ? Math.min(...known) : null;
  }
  return Number(from);
}
