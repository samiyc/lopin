import { readFile } from "node:fs/promises";
import { parseCard, parseCards } from "../src/core/notation.js";
import { rulesOf } from "../src/replay/core/log.js";
import { applyMove, createGame, legalMoves } from "../src/sim/engine/game.js";

/**
 * `npm run hiding`: does the Experimental hide its game? In its self-play
 * (selfplay/, `npm run selfplay`), each time a player first holds a card that
 * completes a strong formation — a straight flush or three of a kind — on a
 * border where it already has two cards: does it play it at once, or keep
 * it; and what becomes of that border and of the game. The bots model
 * nothing of what the opponent infers, so a deferral is the search judging
 * another move better, not a bluff; this measures how often, and at what cost.
 */
const STRONG = new Set(["straightFlush", "threeOfAKind"]);
const source = new URL("../selfplay/experimental_80.json", import.meta.url);

/** Borders `player` could finish now with a strong formation, by border index. */
function strongFinishes(state) {
  const player = state.current;
  const found = new Map();
  for (const move of legalMoves(state)) {
    const side = state.borders[move.border].sides[player];
    if (side.length === 2 && STRONG.has(state.evaluator.formation([...side, move.card]))) found.set(move.border, move);
  }
  return found;
}

function isStrong(state, player, border) {
  const side = state.borders[border].sides[player];
  return side.length === 3 && STRONG.has(state.evaluator.formation(side));
}

function replayGame(log) {
  const { spec, order, jokerRule, endMode } = rulesOf(log.rules);
  const state = createGame(spec, { order, jokerRule, endMode, deck: parseCards(spec, log.deck), rng: null });
  const episodes = new Map();
  for (const entry of log.turns) {
    const move = entry.pass ? null : { card: parseCard(spec, entry.move.card), border: entry.move.border - 1 };
    const fresh = [...strongFinishes(state).keys()].filter((border) => !episodes.has(`${state.current}:${border}`));
    const player = state.current;
    applyMove(state, move);
    // Played at once: that very border now holds the strong formation.
    for (const border of fresh) episodes.set(`${player}:${border}`, { player, border, now: move?.border === border && isStrong(state, player, border), turn: state.turn });
  }
  return [...episodes.values()].map((episode) => {
    return {
      ...episode,
      strongLater: isStrong(state, episode.player, episode.border),
      borderWon: state.borders[episode.border].owner === episode.player,
      gameWon: state.winner === episode.player,
    };
  });
}

const pct = (part, whole) => `${((100 * part) / Math.max(1, whole)).toFixed(1).replace(".", ",")} %`;

function describe(label, rows) {
  const count = (key) => rows.filter((row) => row[key]).length;
  return `| ${label} | ${rows.length} | ${pct(count("strongLater"), rows.length)} | ${pct(count("borderWon"), rows.length)} | ${pct(count("gameWon"), rows.length)} |`;
}

const started = performance.now();
const logs = JSON.parse(await readFile(source, "utf8"));
const episodes = logs.flatMap(replayGame);
const now = episodes.filter((episode) => episode.now);
const kept = episodes.filter((episode) => !episode.now);
const early = (rows) => rows.filter((row) => row.turn <= 21);
console.log(`# Cacher son jeu — ${logs.length} parties d'auto-jeu, ${episodes.length} occasions de finir une borne en suite couleur ou brelan\n`);
console.log("| Choix | Occasions | Formation forte finie | Borne gagnée | Partie gagnée |");
console.log("| --- | --- | --- | --- | --- |");
console.log(describe("Jouée tout de suite", now));
console.log(describe("Gardée pour plus tard", kept));
console.log(describe("… dont avant le tour 22", early(kept)));
console.log(describe("… finie plus tard en forte", kept.filter((row) => row.strongLater)));
console.log(describe("… jamais finie en forte", kept.filter((row) => !row.strongLater)));
console.log(`\nGardée ${pct(kept.length, episodes.length)} des fois. Durée : ${((performance.now() - started) / 1000).toFixed(0)} s`);
