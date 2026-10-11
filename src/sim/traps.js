import { isJoker } from "../core/cards.js";
import { formatCard } from "../core/notation.js";
import { STATUS, borderStatus } from "./certainty.js";
import { forkValue } from "./fork.js";
import { applyMove } from "./game.js";
import { cloneState } from "./lookahead.js";

/**
 * The traps of the endgame (Sami, 07/10, roadmap 1.2): positions where the
 * core's favourite move loses while another move wins. An error is described
 * by what the core's move does to the board, against the winning move the
 * core ranked highest, and filed under one family — the first that applies —
 * so that the most frequent can become a rule of the 1.2 core.
 */
export const FAMILIES = Object.freeze({
  jokerSpent: "joker posé, alors qu'il fallait le garder",
  jokerKept: "joker gardé, alors qu'il fallait le poser",
  deadBorder: "carte jetée sur une borne déjà perdue",
  completesLoser: "côté complété, et la borne est perdue",
  givesBorder: "une borne de plus devient perdue",
  fork: "la borne décisive ou de la double menace (Puissance 4) laissée de côté",
  opensBorder: "borne vierge ouverte",
  wrongBorder: "bonne carte, mauvaise borne",
  wrongCard: "bonne borne, mauvaise carte",
  other: "ni la carte ni la borne du coup gagnant",
});

const lostCount = (state, player) => state.borders.filter((_, index) => borderStatus(state, index, player) === STATUS.lost).length;

const after = (state, move) => {
  const next = cloneState(state);
  applyMove(next, move);
  return next;
};

/** What `move` does for the player to move: the side it lands on, and the borders lost before and after. */
function effectOf(state, move) {
  const player = state.current;
  const side = state.borders[move.border].sides[player];
  const next = after(state, move);
  return {
    joker: isJoker(move.card),
    sideBefore: side.length,
    landsOnLost: borderStatus(state, move.border, player) === STATUS.lost,
    lostBefore: lostCount(state, player),
    lostAfter: lostCount(next, player),
    borderLostAfter: borderStatus(next, move.border, player) === STATUS.lost,
    // fork.js: 1 if the border wins the game at once, ½ if winning it leaves a double threat.
    fork: forkValue(state.borders.map((border) => border.owner), player, state.spec, move.border),
  };
}

/** The board rules, in order: the first that tells the core's move (`core`) from the winning one (`win`) names the family. */
const BOARD_RULES = [
  ["jokerSpent", (core, win) => core.joker && !win.joker],
  ["jokerKept", (core, win) => !core.joker && win.joker],
  ["deadBorder", (core) => core.landsOnLost],
  ["completesLoser", (core) => core.sideBefore === 2 && core.borderLostAfter],
  ["givesBorder", (core, win) => core.lostAfter > core.lostBefore && win.lostAfter <= win.lostBefore],
  ["fork", (core, win) => win.fork > core.fork],
  ["opensBorder", (core, win) => core.sideBefore === 0 && win.sideBefore > 0],
];

/** The family of an error by what it does to the board, or null when the board does not tell the two moves apart. */
export const familyOf = (core, win) => BOARD_RULES.find(([, applies]) => applies(core, win))?.[0] ?? null;

/** By placement, when nothing on the board tells the two moves apart. */
function placementOf(coreMove, winMove) {
  if (coreMove.card === winMove.card) return "wrongBorder";
  if (coreMove.border === winMove.border) return "wrongCard";
  return "other";
}

const sameMove = (a, b) => a.card === b.card && a.border === b.border;

/**
 * The trap at `state`, or null: `solution` is `solveEndgame(state)` (values
 * for the player to move), `ranked` the core's moves, best first. A trap
 * needs a won position and a core favourite that loses.
 */
export function trapOf(state, solution, ranked) {
  if (solution.value !== 1 || ranked.length === 0) return null;
  const valueOf = (move) => solution.moves.find((entry) => sameMove(entry.move, move))?.value;
  const coreMove = ranked[0];
  if (valueOf(coreMove) !== -1) return null;
  const rank = ranked.findIndex((move) => valueOf(move) === 1);
  if (rank < 0) return null;
  const winMove = ranked[rank];
  const core = effectOf(state, coreMove);
  const win = effectOf(state, winMove);
  const text = (move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;
  return {
    family: familyOf(core, win) ?? placementOf(coreMove, winMove),
    coreMove: text(coreMove),
    winMove: text(winMove),
    winRank: rank + 1,
    moves: ranked.length,
    winners: solution.moves.filter((entry) => entry.value === 1).length,
  };
}
