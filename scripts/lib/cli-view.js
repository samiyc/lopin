import { formatCard } from "../../src/core/notation.js";
import { legalMoves } from "../../src/sim/game.js";
import { sortBySuit, sortByValue } from "../../web/app/hand.js";

/**
 * Bornage in a terminal (`npm run cli`, Sami 12/10): what the screen shows
 * and what a typed line means. Pure: the CLI only reads and writes lines.
 *
 * The board is seven columns, one per border, on seven lines: the opponent's
 * side (third card on top), the borders, then the player's side. A border
 * reads `-` while undecided, `A` won by the player, `B` by the opponent, `=`
 * when both sides are full and nobody could claim it yet.
 */
const WIDTH = 5;
const pad = (text) => text.padEnd(WIDTH);

/** The player's hand in the order shown: by suit (the default) or by value. */
export const handOrder = (state, me, sort = "suit") => (sort === "value" ? sortByValue : sortBySuit)(state.spec, state.hands[me]);

function borderMark(border, me) {
  if (border.owner === me) return "A";
  if (border.owner === 1 - me) return "B";
  return border.sides[0].length === 3 && border.sides[1].length === 3 ? "=" : "-";
}

const ownedBy = (state, player) => state.borders.filter((border) => border.owner === player).length;

/** One card line of the board: the `row`-th card of each border's side for `player`, blank where there is none. */
const cardRow = (state, player, row) => state.borders.map((border) => pad(border.sides[player][row] === undefined ? "" : formatCard(state.spec, border.sides[player][row]))).join("").trimEnd();

/** The text screen for player `me`: header, the seven-by-seven board, the numbered hand, the last move. */
export function textView(state, me, { order = handOrder(state, me), last = null, names = ["toi", "robot"] } = {}) {
  const header = `Tour ${state.turn + 1} · pioche ${state.pile.length} · main du ${names[1]} ${state.hands[1 - me].length} · bornes : ${names[0]} ${ownedBy(state, me)}, ${names[1]} ${ownedBy(state, 1 - me)}`;
  const theirs = [2, 1, 0].map((row) => cardRow(state, 1 - me, row));
  const borders = state.borders.map((border, index) => pad(`${index + 1}${borderMark(border, me)}`)).join("").trimEnd();
  const mine = [0, 1, 2].map((row) => cardRow(state, me, row));
  const cards = order.map((card, index) => `${index + 1}:${formatCard(state.spec, card)}`);
  const hand = "Main : " + cards.join("  ");
  return [header, ...(last ? [last] : []), "", ...theirs, borders, ...mine, "", hand].join("\n");
}

/** The legal moves as typed: "card border", the card by its place in `order` (a joker takes the first place it holds). */
export function legalInputs(state, order) {
  return legalMoves(state).map((move) => `${order.indexOf(move.card) + 1} ${move.border + 1}`);
}

/** The same position as one JSON object, for `--machine` and an agent. */
export function machineView(state, me, { order = handOrder(state, me), last = null } = {}) {
  const side = (cards) => cards.map((card) => formatCard(state.spec, card));
  const won = ({ owner }) => {
    if (owner === me) return "me";
    return owner === 1 - me ? "opponent" : null;
  };
  return {
    turn: state.turn + 1,
    pile: state.pile.length,
    opponentHand: state.hands[1 - me].length,
    hand: order.map((card, index) => ({ n: index + 1, card: formatCard(state.spec, card) })),
    borders: state.borders.map((border, index) => ({ n: index + 1, mine: side(border.sides[me]), theirs: side(border.sides[1 - me]), won: won(border) })),
    legal: state.current === me && !state.over ? legalInputs(state, order) : [],
    last,
    over: Boolean(state.over),
    winner: state.over ? won({ owner: state.winner }) : null,
  };
}

export const HELP = "Joue « carte borne » : « 3 5 » pose la 3e carte de ta main sur la borne 5 (séparateurs : espace, virgule, tiret). t : trier par valeur / par couleur · p : passer (seulement sans coup possible) · ? : aide · q : abandonner.";

const COMMANDS = { t: { sort: true }, "?": { help: true }, aide: { help: true }, q: { quit: true }, quitter: { quit: true } };

/**
 * What a typed line means, against the hand shown (`order`) and the legal
 * moves: `{ move }`, `{ pass: true }`, `{ sort | help | quit: true }`, or
 * `{ error }` in plain French.
 */
export function parseInput(text, state, order) {
  const line = String(text).trim().toLowerCase();
  if (Object.hasOwn(COMMANDS, line)) return COMMANDS[line];
  const legal = legalMoves(state);
  if (line === "p" || line === "passer") return legal.length === 0 ? { pass: true } : { error: "Tu as un coup possible : on ne passe que sans coup." };
  const numbers = twoNumbers(line);
  if (!numbers) return { error: `Je n'ai pas compris « ${text} ». ${HELP}` };
  return moveFor(numbers, state, order, legal);
}

/** "3 5", "3,5", "3-5" → [3, 5]; anything else → null. */
function twoNumbers(line) {
  const parts = line.split(/[\s,;/.-]+/).filter(Boolean);
  return parts.length === 2 && parts.every((part) => /^\d+$/.test(part)) ? parts.map(Number) : null;
}

/** The legal move a card place and a border number name, or the reason there is none. */
function moveFor([index, border], state, order, legal) {
  if (index < 1 || index > order.length) return { error: `Carte ${index} : ta main en a ${order.length}.` };
  if (border < 1 || border > state.borders.length) return { error: `Borne ${border} : il y en a ${state.borders.length}.` };
  const card = order[index - 1];
  const move = legal.find((candidate) => candidate.card === card && candidate.border === border - 1);
  if (!move) return { error: `${formatCard(state.spec, card)} ne peut pas aller sur la borne ${border} (ton côté est plein, ou la borne est revendiquée).` };
  return { move };
}
