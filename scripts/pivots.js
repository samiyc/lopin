import { OFFICIAL_RULES } from "../src/config/rules.js";
import { isJoker } from "../src/core/cards.js";
import { createRng } from "../src/core/random.js";
import { rulesOf } from "../src/replay/core/log.js";
import { strategistBot } from "../src/sim/bots.js";
import { solveEndgame } from "../src/sim/eval/endgame.js";
import { EXPERIMENT } from "../src/sim/heuristics/experimental.js";
import { applyMove, createGame, legalMoves } from "../src/sim/engine/game.js";
import { cloneState } from "../src/sim/search/lookahead.js";

/**
 * `npm run pivots`: when do the game's turning points come, and can the
 * exact solver take over once the pile is empty? (merlin-is-dead)
 *
 * On games between two experimental cores at the page's rule, the turn of:
 * the pile running out; a player having a card on all seven borders; the
 * first border proved; the last joker played. Then, at every position from
 * the pile running out, the exact solver's time and whether it finishes
 * within `NODES` positions, by cards left — today it only plays at 8 or fewer.
 */
const GAMES = 200;
const NODES = 400_000;
const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
const started = performance.now();

const allStarted = (state, player) => state.borders.every((border) => border.sides[player].length > 0);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))];

function markTurningPoints(state, mark) {
  mark("pioche vide", state.pile.length === 0);
  mark("7 bornes entamées (un joueur)", allStarted(state, 0) || allStarted(state, 1));
  mark("7 bornes entamées (les deux)", allStarted(state, 0) && allStarted(state, 1));
  mark("1re borne prouvée", state.borders.some((border) => border.owner !== null));
}

/** The turns at which each turning point first came, and the positions from the empty pile on. */
function playGame(seed) {
  const rng = createRng(seed);
  const bots = [strategistBot(rng, EXPERIMENT), strategistBot(rng, EXPERIMENT)];
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  const turns = {};
  const late = [];
  const mark = (name, when) => {
    if (when && turns[name] === undefined) turns[name] = state.turn;
  };
  while (!state.over) {
    markTurningPoints(state, mark);
    if (state.pile.length === 0 && legalMoves(state).length > 1) late.push(cloneState(state));
    const moves = legalMoves(state);
    const move = moves.length > 0 ? bots[state.current].choose(state, moves) : null;
    applyMove(state, move);
    if (move && isJoker(move.card)) turns["dernier joker posé"] = state.turn;
  }
  return { turns, late };
}

const games = Array.from({ length: GAMES }, (_, i) => playGame(9_100 + i));
console.log(`# Points charnières — ${GAMES} parties entre deux cœurs expérimentaux, règle de la page\n`);
console.log("| Moment | Parties où il arrive | Tour médian | 10 % – 90 % |");
console.log("| --- | --- | --- | --- |");
for (const name of ["7 bornes entamées (un joueur)", "7 bornes entamées (les deux)", "1re borne prouvée", "dernier joker posé", "pioche vide"]) {
  const seen = games.map(({ turns }) => turns[name]).filter((turn) => turn !== undefined);
  console.log(`| ${name} | ${seen.length} | ${median(seen)} | ${quantile(seen, 0.1)} – ${quantile(seen, 0.9)} |`);
}

const byCards = new Map();
for (const state of games.flatMap(({ late }) => late)) {
  const solveStarted = performance.now();
  const { complete, cardsLeft } = solveEndgame(state, { stopAtWin: true, maxNodes: NODES });
  if (!byCards.has(cardsLeft)) byCards.set(cardsLeft, { ms: [], done: 0 });
  const row = byCards.get(cardsLeft);
  row.ms.push(performance.now() - solveStarted);
  row.done += Number(complete);
}
console.log(`\n## Le solveur exact à pioche vide (${NODES.toLocaleString("fr-FR")} positions au plus)\n`);
console.log("| Cartes en main (les deux) | Positions | Résolues | Temps médian | 90 % sous |");
console.log("| --- | --- | --- | --- | --- |");
for (const cards of [...byCards.keys()].sort((a, b) => b - a)) {
  const { ms, done } = byCards.get(cards);
  console.log(`| ${cards} | ${ms.length} | ${Math.round((100 * done) / ms.length)} % | ${median(ms).toFixed(0)} ms | ${quantile(ms, 0.9).toFixed(0)} ms |`);
}
console.log(`\nDurée : ${((performance.now() - started) / 1000).toFixed(0)} s`);
