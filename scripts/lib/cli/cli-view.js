import { formatCard } from "../../../src/core/notation.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { suitCounts } from "../../../web/app/replays/view.js";
import { handOrder } from "./cli-screen.js";

// The text screen people play on (Sami's template, 14/10) lives in cli-screen.js; its names are this module's too.
export { LEGEND, SUIT_CODES, handOrder, lookOf, shortCard, textView, visible } from "./cli-screen.js";

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

function borderMark(border, me) {
  if (border.owner === me) return "A";
  if (border.owner === 1 - me) return "B";
  return border.sides[0].length === 3 && border.sides[1].length === 3 ? "=" : "-";
}

const ownedBy = (state, player) => state.borders.filter((border) => border.owner === player).length;

/** One card line of the board: the `row`-th card of each border's side for `player`, blank where there is none. */
const cardRow = (state, player, row) => state.borders.map((border) => pad(border.sides[player][row] === undefined ? "" : formatCard(state.spec, border.sides[player][row]))).join("").trimEnd();

/**
 * The cards of each suit the player can see (both sides of the board and
 * their own hand) out of the deck's, as the page's suit bar shows them:
 * « Vues : ♠ 7/10 · ♥ 5/10 · ♣ 6/10 · ♦ 4/10 · JK 1/2 ».
 */
export function seenLine(state, me) {
  const counts = suitCounts(state.spec, state, { bottom: me, reveal: false });
  return "Vues : " + counts.map(({ label, seen, total }) => `${label} ${seen}/${total}`).join(" · ");
}

/**
 * The board as llm-play's prompt knows it (`--machine`'s `board`): header, the last move, the cards seen, the
 * seven-by-seven board, the numbered hand. The screen people play on is `textView`.
 */
export function boardText(state, me, { order = handOrder(state, me), last = null, names = ["toi", "robot"] } = {}) {
  const header = `Tour ${state.turn + 1} · pioche ${state.pile.length} · main du ${names[1]} ${state.hands[1 - me].length} · bornes : ${names[0]} ${ownedBy(state, me)}, ${names[1]} ${ownedBy(state, 1 - me)}`;
  const theirs = [2, 1, 0].map((row) => cardRow(state, 1 - me, row));
  const borders = state.borders.map((border, index) => pad(`${index + 1}${borderMark(border, me)}`)).join("").trimEnd();
  const mine = [0, 1, 2].map((row) => cardRow(state, me, row));
  const cards = order.map((card, index) => `${index + 1}:${formatCard(state.spec, card)}`);
  const hand = "Main : " + cards.join("  ");
  return [header, ...(last ? [last] : []), seenLine(state, me), "", ...theirs, borders, ...mine, "", hand].join("\n");
}

/** Is it `me`'s turn in a game still going? */
const playable = (state, me) => state.current === me && !state.over;

/** The rules in one line, at the head of an agent's game (docs/agents/regles.md has them in full). */
export const RULES_LINE = "7 bornes ; 3 cartes par joueur et par borne : Suite couleur > Brelan > Couleur > Suite > Somme, puis la plus forte somme, puis qui a fini le premier ; joker sans couleur (n'importe quelle valeur) ; une borne se revendique dès que ton côté complet ne peut plus être battu ; victoire : 3 bornes voisines ou 4 bornes.";

/** The cards of a side, written « 7♠ ». */
const sideOf = (state, cards) => cards.map((card) => formatCard(state.spec, card));

/** The cards seen per suit, « 5/10 » (the page's suit bar). */
const seenOf = (state, me) => Object.fromEntries(suitCounts(state.spec, state, { bottom: me, reveal: false }).map(({ label, seen, total }) => [label, `${seen}/${total}`]));

/**
 * The legal moves, the card named (« 8♠ 4 »), the only list an agent reads (Sami, 13/10: the hand's numbers, « 1 1 »,
 * told nothing, and they move with each draw).
 */
const movesOf = (state, me) => (playable(state, me) ? legalMoves(state).map((move) => `${formatCard(state.spec, move.card)} ${move.border + 1}`) : []);

/**
 * The borders a card may go on (Sami, 13/10, in place of the list of every card × border, « 3♠ 1 », « 3♠ 2 »…: the
 * base game's moves are the whole hand on each of these, so this short list says the same). Empty: pass.
 */
const playableBorders = (state, me) => (playable(state, me) ? [...new Set(legalMoves(state).map((move) => move.border + 1))].sort((a, b) => a - b) : []);

/** How a move is written, said in the rules line of `--json`'s first answer. */
export const ANSWER_LINE = "Un coup : une carte de ta main puis une borne jouable, « 7♠ 5 » pose le 7♠ sur la borne 5 ; sans borne jouable, « p ».";

/** `libre`, `gagnée` (yours), `perdue` (the robot's), or `pleine`: both sides full, nobody could claim it yet. */
function statusOf(border, me) {
  if (border.owner === me) return "gagnée";
  if (border.owner === 1 - me) return "perdue";
  return border.sides[0].length === 3 && border.sides[1].length === 3 ? "pleine" : "libre";
}

/**
 * What just happened, as an object (Sami, 13/10): `toi` and `robot`, each « 9♦ → borne 4 », and `revendications`
 * (the borders claimed, in words) only when there are some. A side that did not move has no key.
 */
const exchangeOf = (last) => ({
  ...(last?.toi ? { toi: last.toi } : {}),
  ...(last?.robot ? { robot: last.robot } : {}),
  ...(last?.revendications?.length > 0 ? { revendications: last.revendications } : {}),
});

/**
 * The position as a real JSON object (Sami, 13/10: no board drawn in a string, the data named and grouped):
 * what `--json` prints and an agent reads. `last`: `{ toi, robot, revendications }` of the exchange just played.
 */
export function jsonView(state, me, { order = handOrder(state, me), last = null } = {}) {
  return {
    tour: state.turn + 1,
    pioche: state.pile.length,
    main_robot: state.hands[1 - me].length,
    bornes_gagnees: { toi: ownedBy(state, me), robot: ownedBy(state, 1 - me) },
    cartes_vues: seenOf(state, me),
    dernier_echange: exchangeOf(last),
    bornes: state.borders.map((border, index) => ({ borne: index + 1, toi: sideOf(state, border.sides[me]), robot: sideOf(state, border.sides[1 - me]), statut: statusOf(border, me) })),
    main: sideOf(state, order),
    bornes_jouables: playableBorders(state, me),
    terminee: Boolean(state.over),
    ...(state.turn < 2 ? { regles: `${RULES_LINE} ${ANSWER_LINE}` } : {}),
  };
}

/** A JSON object laid out for a person: one key a line, the list of objects (the borders) one object a line. */
export function formatJson(object) {
  const rows = (list) => list.map((item) => "  " + JSON.stringify(item)).join(",\n");
  const lines = Object.entries(object).map(([key, value]) => {
    const objects = Array.isArray(value) && value.some((item) => typeof item === "object" && item !== null);
    return " " + JSON.stringify(key) + ": " + (objects ? "[\n" + rows(value) + "\n ]" : JSON.stringify(value));
  });
  return "{\n" + lines.join(",\n") + "\n}";
}

/** The same position as one JSON object, for `--machine` (llm-play): the facts, and `board`, the screen as text. */
export function machineView(state, me, { order = handOrder(state, me), last = null } = {}) {
  const won = ({ owner }) => {
    if (owner === me) return "me";
    return owner === 1 - me ? "opponent" : null;
  };
  return {
    turn: state.turn + 1,
    pile: state.pile.length,
    opponentHand: state.hands[1 - me].length,
    hand: order.map((card, index) => ({ n: index + 1, card: formatCard(state.spec, card) })),
    borders: state.borders.map((border, index) => ({ n: index + 1, mine: sideOf(state, border.sides[me]), theirs: sideOf(state, border.sides[1 - me]), won: won(border) })),
    seen: seenOf(state, me),
    moves: movesOf(state, me),
    last,
    over: Boolean(state.over),
    winner: state.over ? won({ owner: state.winner }) : null,
    board: boardText(state, me, { order, last }),
    ...(state.turn < 2 ? { rules: RULES_LINE } : {}),
  };
}

const plural = (count, word) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** « 3 », « 3 et 5 », « 1, 3 et 5 ». */
const listOf = (numbers) => (numbers.length < 2 ? String(numbers[0]) : `${numbers.slice(0, -1).join(", ")} et ${numbers.at(-1)}`);

/** Who claimed what, said as such (Sami, 12/10): « tu revendiques la borne 7 », « le robot revendique les bornes 2 et 4 ». */
export function claimText(borders, me) {
  const by = (player) => borders.filter((border) => border.owner === player).map((border) => border.index + 1);
  const say = (numbers, who, verb) => (numbers.length === 0 ? [] : [`${who} ${verb} ${numbers.length > 1 ? "les bornes" : "la borne"} ${listOf(numbers)}`]);
  return [...say(by(me), "tu", "revendiques"), ...say(by(1 - me), "le robot", "revendique")].join(", ");
}

/** The borders of the winner's run of three (or more) adjacent ones, numbered from 1. */
function winningRun(state) {
  let run = [];
  for (const [index, border] of state.borders.entries()) {
    run = border.owner === state.winner ? [...run, index + 1] : [];
    if (run.length >= state.spec.adjacent) return run;
  }
  return run;
}

/**
 * The end of the game in words (Sami, 12/10): who won, with which borders,
 * and — the page's claim rule lets the player who just moved claim first —
 * the borders the loser could have claimed when the game stopped.
 */
export function endText(state, me, { canClaim = () => false } = {}) {
  const won = (player) => state.borders.flatMap((border, index) => (border.owner === player ? [index + 1] : []));
  if (state.winner === null) return `Partie nulle, ${plural(won(me).length, "borne")} à ${won(1 - me).length}.`;
  const winner = state.winner === me ? "Gagné : tu gagnes" : "Perdu : le robot l'emporte";
  const how = state.winType === "adjacent" ? `bornes ${winningRun(state).join("-")} à la suite` : `${plural(won(state.winner).length, "borne")} (${listOf(won(state.winner))})`;
  return `${winner}, ${how}.${missedNote(state, me, canClaim)}`;
}

/** The borders the loser could have claimed when the game stopped, or nothing. */
function missedNote(state, me, canClaim) {
  const loser = 1 - state.winner;
  const missed = state.borders.flatMap((border, index) => (border.owner === null && canClaim(index, loser) ? [index + 1] : []));
  if (missed.length === 0) return "";
  const owner = loser === me ? "à toi" : "au robot";
  const which = missed.length > 1 ? `Les bornes ${listOf(missed)} étaient` : `La borne ${missed[0]} était`;
  return ` ${which} ${owner}, mais celui qui vient de jouer revendique en premier, et la partie s'arrête à la première victoire.`;
}

export const HELP = "Joue la carte puis la borne : « 7h4 » pose le 7 de cœur sur la borne 4 (couleurs : P pique, H cœur, T trèfle, C carreau ; avec --gb, S H C D : C trèfle, D carreau) ; « 7h 4 », « 7♥ 4 » ou « 3 4 » (la 3e carte de ta main) aussi. t : trier par valeur / par couleur · p : passer (seulement sans coup possible) · ? : aide · q : abandonner.";

const COMMANDS = { t: { sort: true }, "?": { help: true }, aide: { help: true }, q: { quit: true }, quitter: { quit: true } };

/**
 * What a typed line means, against the hand shown (`order`) and the legal
 * moves: `{ move }`, `{ pass: true }`, `{ sort | help | quit: true }`, or
 * `{ error }` in plain French. `letters`: the screen's alphabet, which says what « c » is.
 */
export function parseInput(text, state, order, options) {
  const line = String(text).trim().toLowerCase();
  if (Object.hasOwn(COMMANDS, line)) return COMMANDS[line];
  const legal = legalMoves(state);
  if (line === "p" || line === "passer") return legal.length === 0 ? { pass: true } : { error: "Tu as un coup possible : on ne passe que sans coup." };
  const numbers = cardAndBorder(line, state, order, suitsOf(options));
  if (!numbers) return { error: `Je n'ai pas compris « ${text} ». ${HELP}` };
  // Well written, but not in the hand (Sami, 13/10: « 9♥ 4 » was answered by the whole help).
  if (numbers.absent) return { error: `${numbers.absent} n'est pas dans ta main : ${order.map((card) => formatCard(state.spec, card)).join(" ")}.` };
  return moveFor(numbers, state, order, legal);
}

/**
 * Suit letters an agent or a keyboard may type for ♠ ♥ ♣ ♦, both alphabets read: only « c » differs, and it is
 * what the screen writes (Sami, 14/10) — carreau in French (clubs are « t »), clubs with `--gb`.
 */
const BOTH_ALPHABETS = { s: "♠", p: "♠", h: "♥", t: "♣", d: "♦", k: "♦" };
const SUIT_LETTERS = { fr: { ...BOTH_ALPHABETS, c: "♦" }, gb: { ...BOTH_ALPHABETS, c: "♣" } };
const suitsOf = ({ letters = "fr" } = {}) => SUIT_LETTERS[letters];

/** A card as typed (« 4♦ », « 4d », « jk ») in the notation of the game's cards (« 4♦ », « JK »). */
const writtenCard = (text, suits) => (text.toUpperCase() === "JK" ? "JK" : text.replace(/[a-z]$/, (letter) => suits[letter] ?? letter));

/** The place in `order` of a card written out, or 0. */
function placeOfCard(text, state, order, suits) {
  const typed = writtenCard(text, suits);
  return order.findIndex((card) => formatCard(state.spec, card) === typed) + 1;
}

/**
 * "3 5", "3,5", "3-5" → [3, 5]; the card may also be written out, "4♦ 5"
 * or "4d 5" (Sami's pilot agent, 12/10: the hand's numbers move with each
 * draw, and « 4 3 » played the 2♦ it meant as the 4♦); anything else → null.
 */
function cardAndBorder(line, state, order, suits) {
  // « 7h4 », « 10p2 », « jk5 » (Sami's template, 14/10): the card and the border with nothing between.
  const joined = /^((?:10|[1-9])[a-z♠♥♣♦]|jk)(\d)$/.exec(line);
  const parts = joined ? [joined[1], joined[2]] : line.replaceAll(/(\d)-(\d)/g, "$1 $2").split(/[\s,;/]+/).filter(Boolean);
  if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return null;
  const place = /^\d+$/.test(parts[0]) ? Number(parts[0]) : placeOfCard(parts[0], state, order, suits);
  if (place > 0) return [place, Number(parts[1])];
  // A card written as a card (« 9♥ », « 9h », « jk ») that the hand does not hold.
  return /^(10|[1-9])[a-z♠♥♣♦]$|^jk$/i.test(parts[0]) ? { absent: writtenCard(parts[0], suits) } : null;
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
