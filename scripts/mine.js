import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCard, parseCards } from "../src/core/notation.js";
import { rulesOf } from "../src/replay/core/log.js";
import { cardCost } from "../src/sim/bots.js";
import { STATUS, borderStatus, boardStatus } from "../src/sim/eval/certainty.js";
import { applyMove, createGame, legalMoves } from "../src/sim/engine/game.js";
import { cloneState } from "../src/sim/search/lookahead.js";

/**
 * `npm run mine -- [selfplay file]`: how far the self-play games already
 * follow the proved patterns (src/sim/eval/certainty.js), decision by decision.
 *
 * - dump: the mover has a border already lost with room on its side — does it
 *   play there, and when it does, is it the cheapest card it could put there?
 * - secure: a move exists that completes a border into a certain win — does it
 *   take one?
 * - obvious: how far the chosen move led the runner-up in the search.
 */
const file = process.argv[2] ?? fileURLToPath(new URL("../selfplay/experimental_80.json", import.meta.url));
const logs = JSON.parse(await readFile(file, "utf8"));
const started = Date.now();
const tally = { decisions: 0, lostOpen: 0, playedLost: 0, cheapest: 0, securable: 0, secured: 0, gaps: [] };

const moveOf = (spec, entry) => ({ card: parseCard(spec, entry.move.card), border: entry.move.border - 1 });
const secures = (state, move) => {
  if (state.borders[move.border].sides[state.current].length !== 2) return false;
  const next = cloneState(state);
  const player = state.current;
  applyMove(next, move);
  return borderStatus(next, move.border, player) === STATUS.won;
};

/** The dump pattern at one decision. */
function examineDump(state, moves, played) {
  const { spec } = state;
  const statuses = boardStatus(state, state.current);
  const lostOpen = moves.filter((move) => statuses[move.border] === STATUS.lost);
  if (lostOpen.length > 0) {
    tally.lostOpen += 1;
    if (statuses[played.border] === STATUS.lost) {
      tally.playedLost += 1;
      const cheapest = Math.min(...lostOpen.map((move) => cardCost(spec, move.card)));
      if (cardCost(spec, played.card) <= cheapest + 1e-9) tally.cheapest += 1;
    }
  }
}

function examine(state, entry) {
  const moves = legalMoves(state);
  const played = moveOf(state.spec, entry);
  tally.decisions += 1;
  examineDump(state, moves, played);
  const securing = moves.filter((move) => secures(state, move));
  if (securing.length > 0) {
    tally.securable += 1;
    if (securing.some((move) => move.card === played.card && move.border === played.border)) tally.secured += 1;
  }
  const [first, second] = entry.candidates ?? [];
  if (first && second) tally.gaps.push(first.gain - second.gain);
}

for (const log of logs) {
  const { spec, order, jokerRule, endMode } = rulesOf(log.rules);
  const state = createGame(spec, { order, jokerRule, endMode, deck: parseCards(spec, log.deck), rng: null });
  for (const entry of log.turns) {
    if (entry.move) examine(state, entry);
    applyMove(state, entry.move ? moveOf(spec, entry) : null);
  }
}

const pct = (part, whole) => (whole ? `${((100 * part) / whole).toFixed(1)} %` : "—");
const gaps = tally.gaps.sort((a, b) => a - b);
const quantile = (q) => gaps[Math.floor(q * (gaps.length - 1))]?.toFixed(3);
process.stdout.write(
  [
    `${logs.length} parties, ${tally.decisions} décisions (${((Date.now() - started) / 1000).toFixed(0)} s)`,
    `Défausse : une borne perdue d'avance était jouable dans ${pct(tally.lostOpen, tally.decisions)} des décisions ;`,
    `  le robot y a joué ${pct(tally.playedLost, tally.lostOpen)} des fois, et c'était sa carte la moins chère ${pct(tally.cheapest, tally.playedLost)} des fois.`,
    `Borne gagnée à coup sûr : possible dans ${pct(tally.securable, tally.decisions)} des décisions, prise ${pct(tally.secured, tally.securable)} des fois.`,
    `Écart entre le coup choisi et le suivant (taux de victoire estimé) : médiane ${quantile(0.5)}, 25 % ${quantile(0.25)}, 75 % ${quantile(0.75)} ;`,
    `  coups « évidents » (écart > 0,15) : ${pct(gaps.filter((gap) => gap > 0.15).length, gaps.length)}.`,
    "",
  ].join("\n"),
);
