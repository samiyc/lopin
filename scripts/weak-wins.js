import { writeFile } from "node:fs/promises";
import { isJoker, valueOf } from "../src/core/cards.js";
import { parseCards } from "../src/core/notation.js";
import { rulesOf } from "../src/replay/core/log.js";
import { loadGame, readIndex } from "./lib/domain/game-index.js";

/**
 * `npm run weak-wins`: the borders won with low cards — every real card 3 or
 * less (1-2-3, 1-1-1, a joker welcome) — in the kept bot games, and how they
 * came about (Sami, 02/10: are they traps?). For each, read from the result
 * and the moves on that border:
 *
 * - what won it: the low side's formation against the other's (or a claim,
 *   the other side unfinished but proved beaten);
 * - who started the border, who finished first, and whether the loser kept
 *   feeding it after the low side was full;
 * - how high the loser's cards were, and whether its side was a figure at all.
 *
 * Every border won is counted the same way, as the baseline.
 */
const RANKS = { straightFlush: 5, threeOfAKind: 4, flush: 3, straight: 2, sum: 1 };
const LABELS = { straightFlush: "suite de couleur", threeOfAKind: "brelan", flush: "couleur", straight: "suite", sum: "somme" };

/** The moves on `border`, in order: who played, on which turn. */
const movesOn = (log, border) => log.turns.filter((turn) => !turn.pass && turn.move.border === border);

const realValues = (spec, cards) => cards.filter((card) => !isJoker(card)).map((card) => valueOf(spec, card));
const isLow = (spec, cards) => {
  const values = realValues(spec, cards);
  return values.length > 0 && values.every((value) => value <= 3);
};

/** Who started the border, who finished first, and whether the loser played on after the winner was full. */
function timeline(log, entry) {
  const { winner } = entry;
  const moves = movesOn(log, entry.border);
  const filled = (player) => moves.filter((turn) => turn.player === player)[2]?.turn ?? null;
  const [doneWin, doneLoss] = [filled(winner), filled(1 - winner)];
  return {
    startedByWinner: moves[0]?.player === winner,
    winnerFirst: doneWin !== null && (doneLoss === null || doneWin < doneLoss),
    fedAfter: doneWin !== null && moves.some((turn) => turn.player !== winner && turn.turn > doneWin),
  };
}

/** The two sides' formations, and how high the loser's cards were. */
function faceOff(spec, entry) {
  const { winner } = entry;
  const [mineForm, theirForm] = [entry.formations[winner], entry.formations[1 - winner]];
  const theirValues = realValues(spec, parseCards(spec, entry.sides[1 - winner]));
  const mean = theirValues.reduce((a, b) => a + b, 0) / Math.max(1, theirValues.length);
  return {
    mine: LABELS[mineForm] ?? "inachevé",
    theirs: LABELS[theirForm] ?? "inachevé",
    rankBeat: Boolean(mineForm && theirForm && RANKS[mineForm] > RANKS[theirForm]),
    theirHigh: mean >= 6,
    theirJunk: theirForm === "sum" || theirForm === "straight",
  };
}

function storyOf(spec, log, entry) {
  return {
    low: isLow(spec, parseCards(spec, entry.sides[entry.winner])),
    how: entry.decidedBy,
    ...faceOff(spec, entry),
    ...timeline(log, entry),
    gameWon: log.result.winner === entry.winner,
    turn: entry.claimedAt ?? entry.filledAt,
  };
}

const share = (rows, test) => (rows.length ? rows.filter(test).length / rows.length : 0);
const pct = (x) => `${String(Math.round(100 * x)).padStart(3)} %`;
const QUESTIONS = [
  ["gagnée par une figure plus haute que celle d'en face", (row) => row.rankBeat],
  ["gagnée sur preuve, l'autre côté inachevé (claim)", (row) => row.how === "claim"],
  ["côté d'en face : suite simple ou somme (pas de vraie figure)", (row) => row.theirJunk],
  ["côté d'en face : cartes hautes (moyenne 6 ou plus)", (row) => row.theirHigh],
  ["borne ouverte par le gagnant", (row) => row.startedByWinner],
  ["le gagnant a fini son côté le premier", (row) => row.winnerFirst],
  ["l'adversaire a encore joué dessus après", (row) => row.fedAfter],
  ["la partie aussi est gagnée", (row) => row.gameWon],
];

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${pct(n / rows.length).trim()}`).join(", ");
}

const rows = (await readIndex()).filter((row) => row.winner === 0 || row.winner === 1);
const stories = [];
for (const row of rows) {
  const log = await loadGame(row);
  const { spec } = rulesOf(log.rules);
  for (const entry of log.result.borders) if (entry.winner === 0 || entry.winner === 1) stories.push(storyOf(spec, log, entry));
}
const low = stories.filter((story) => story.low);
console.log(`Bornes gagnées : ${stories.length}, dont ${low.length} avec des cartes de 1 à 3 (${pct(low.length / stories.length).trim()}), dans ${rows.length} parties.\n`);
console.log(`  cartes 1-3   toutes   ce qui s'est passé`);
for (const [label, test] of QUESTIONS) console.log(`     ${pct(share(low, test))}     ${pct(share(stories, test))}   ${label}`);
console.log(`\nFigure du côté faible : ${countBy(low, "mine")}`);
console.log(`Côté d'en face : ${countBy(low, "theirs")}`);
console.log(`Décidée par : ${countBy(low, "how")}`);
const turns = low.map((story) => story.turn).filter(Number.isFinite);
console.log(`Tour où elle se règle : moyenne ${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)} (toutes : ${(stories.map((s) => s.turn).filter(Number.isFinite).reduce((a, b, _, all) => a + b / all.length, 0)).toFixed(1)})`);
await writeFile(new URL("../data/weak-wins.json", import.meta.url), `${JSON.stringify({ built: new Date().toISOString().slice(0, 10), borders: stories.length, low: low.length, questions: QUESTIONS.map(([label, test]) => ({ label, low: share(low, test), all: share(stories, test) })) }, null, 1)}\n`);
