import { formatCard } from "../../../src/core/notation.js";
import { sortBySuit, sortByValue } from "../../../web/app/board/hand.js";
import { suitCounts } from "../../../web/app/replays/view.js";

/**
 * The text screen of `npm run cli` (Sami's template, 14/10): turn, pile and the last exchange, the cards seen per
 * suit, the framed board, the hand and the legend, in the suit letters (P H T C, or S H C D) and colours chosen.
 * Pure; cli-view.js re-exports it beside the JSON views and the input.
 */

/** The player's hand in the order shown: by suit (the default) or by value. */
export const handOrder = (state, me, sort = "suit") => (sort === "value" ? sortByValue : sortBySuit)(state.spec, state.hands[me]);

/**
 * The suits as one letter on the screen (Sami, 14/10): the French ones by default, P H T C — « Pchit ! » —, the
 * English ones S H C D with `--gb`. The same letters are read back from the keyboard.
 */
export const SUIT_CODES = {
  fr: { "♠": "P", "♥": "H", "♣": "T", "♦": "C" },
  gb: { "♠": "S", "♥": "H", "♣": "C", "♦": "D" },
};

/** « 8♥ » → « 8H », « 10♠ » → « 10P » (« 10S » with `gb`), « JK » stays: every card of a text in two or three characters. */
export const shortCard = (text, letters = "fr") => text.replaceAll(/[♠♥♣♦]/g, (suit) => SUIT_CODES[letters][suit]);

/** The colours the text screen may paint a card in (Sami, 14/10): `0` none, `2` red and black, `4` ♥ red, ♦ blue, ♣ green. */
const ESC = String.fromCharCode(27);
// The joker keeps the text's own colour (Sami, 14/10: bold hardly showed, violet made one colour too many).
const SGR = { red: "31", green: "32", blue: "34" };
const TONES = {
  0: {},
  2: { "♥": "red", "♦": "red" },
  4: { "♥": "red", "♦": "blue", "♣": "green" },
};
const ANSI_CODE = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

/** The text a terminal shows, colour codes left out: what widths are measured on. */
export const visible = (text) => text.replaceAll(ANSI_CODE, "");

/**
 * How the screen writes cards: the suit letters (`fr` or `gb`) and the colours (`0`, `2`, `4`, standard ANSI codes,
 * so a terminal theme such as Solarized maps them to its own soft tones). `card("8♥")` gives the short code and the
 * same in its colour; `suit("♥", "H")` paints a suit's label.
 */
export function lookOf(letters = "fr", colors = 0) {
  const tones = TONES[colors] ?? TONES[0];
  const tint = (text, tone) => (tone ? `${ESC}[${SGR[tone]}m${text}${ESC}[0m` : text);
  return {
    letters,
    card(formatted) {
      const plain = shortCard(formatted, letters);
      return { plain, shown: tint(plain, tones[formatted === "JK" ? "JK" : formatted.slice(-1)]) };
    },
    suit: (symbol, text) => tint(text, tones[symbol]),
  };
}

/** A card right-aligned on `width` characters, its colour codes outside the count. */
const padded = ({ plain, shown }, width) => " ".repeat(Math.max(0, width - plain.length)) + shown;

const cardOf = (state, card, look) => look.card(formatCard(state.spec, card));

/** A slot of a side with no card yet. */
const EMPTY_SLOT = { plain: "··", shown: "··" };

/**
 * One border's side for `player`, cards in the rows asked, each right-aligned on three characters (« 4H », « 10H »
 * end in the same column, Sami 14/10): `··` where there is none, then a bar when `player` won the border — the bar
 * the border's corner (`═╗` / `═╝`) points to — or a space.
 */
function sideCells(state, border, player, { rows, look }) {
  const won = border.owner === player;
  return rows.map((row) => {
    const card = border.sides[player][row];
    return padded(card === undefined ? EMPTY_SLOT : cardOf(state, card, look), 3) + (won ? "│" : " ");
  });
}

/** ` 4─ ` undecided (or full, nobody able to claim it yet), ` 1═╗` won by the player (below), ` 6═╝` by the opponent. */
function borderCell(border, index, me) {
  const number = String(index + 1).padStart(2);
  if (border.owner === me) return `${number}═╗`;
  if (border.owner === 1 - me) return `${number}═╝`;
  return `${number}─ `;
}

/** The opponent's side (third card on top), the borders, the player's side, framed: seven cells of four, always 34 wide. */
function framedBoard(state, me, look) {
  const sides = (player, rows) => state.borders.map((border) => sideCells(state, border, player, { rows, look }));
  const theirs = sides(1 - me, [2, 1, 0]);
  const mine = sides(me, [0, 1, 2]);
  const rows = [
    ...[0, 1, 2].map((row) => theirs.map((cells) => cells[row]).join(" ")),
    state.borders.map((border, index) => borderCell(border, index, me)).join(" "),
    ...[0, 1, 2].map((row) => mine.map((cells) => cells[row]).join(" ")),
  ];
  const width = visible(rows[0]).length;
  return [` ╭${"─".repeat(width)}╮`, ...rows.map((row) => ` │${row}│`), ` ╰${"─".repeat(width)}╯`];
}

/** « Expérimental » → « EXP »: the bot's tag in the header. */
const tagOf = (name) => name.normalize("NFD").replaceAll(/\p{M}/gu, "").slice(0, 3).toUpperCase();

/** « 8♥ → borne 1 » → « 8H1 », the card in its colour; « passe » stays; the bot's moves in a row are joined by « ; ». */
function moveCode(text, look) {
  return text
    .split(" ; ")
    .map((move) => {
      if (move === "passe") return move;
      const [card, border] = move.split(" → borne ");
      return look.card(card).shown + (border ?? "");
    })
    .join(";");
}

/** The cards seen per suit, two digits for the suits: « P:02/10 | H:07/10 | T:05/10 | C:06/10 | JK:0/2 », each letter in its colour. */
function seenCodes(state, me, look) {
  const counts = suitCounts(state.spec, state, { bottom: me, reveal: false });
  const code = (label) => look.suit(label, SUIT_CODES[look.letters][label] ?? label);
  return counts.map(({ label, seen, total }) => (label === "JK" ? `${look.suit("JK", "JK")}:${seen}/${total}` : `${code(label)}:${String(seen).padStart(2, "0")}/${total}`)).join(" | ");
}

/** What the screen's foot says every turn: the suit letters in use and how a move is typed. */
// Three short lines (Sami, 14/10): the one with the four names wrapped in a narrow terminal.
export const LEGEND = {
  fr: ["FR => PCHT Prononcé Pchit!", "P:Pic H:Heart T:Trefle C:Carreau", "Input exemple: 7h4 (7Coeur sur la borne 4)"],
  gb: ["GB => SHCD", "S:Spade H:Heart C:Club D:Diamond", "Input exemple: 7h4 (7Coeur sur la borne 4)"],
};

/**
 * The text screen for player `me` (Sami's template, 14/10): turn, pile, the opponent's hand and the last exchange
 * (« U:8H1 ─ EXP:9T1 »), the cards seen per suit, the framed board, the hand, the claims just made, the legend.
 * `last`: `{ toi, robot, revendications }`, the moves written « 8♥ → borne 1 »; `bot`: the bot's name; `letters`:
 * `fr` (P H T C) or `gb` (S H C D); `colors`: `0`, `2` or `4` (`lookOf`).
 */
export function textView(state, me, { order = handOrder(state, me), last = null, bot = "robot", letters = "fr", colors = 0 } = {}) {
  const look = lookOf(letters, colors);
  const hand = `  --=[ ${order.map((card) => cardOf(state, card, look).shown).join("  ")} ]=--`;
  return [` ${headerLine(state, me, last ?? {}, { bot, look })}`, ` ${seenCodes(state, me, look)}`, ...framedBoard(state, me, look), hand, ...claimLines(last), "", ...LEGEND[letters]].join("\n");
}

/** The claims of the exchange, on one line under the hand; none, no line. */
const claimLines = (last) => (last?.revendications?.length > 0 ? [`  ${last.revendications.join(", ")}`] : []);

/** Two digits, so the header's columns do not shift (Sami, 14/10): « 05 »; the empty pile is « -- ». */
const twoDigits = (count) => String(count).padStart(2, "0");

/** « TURN:15 | DECK:16 | OHAND:6 | U:8H1 ─ EXP:9T1 »: fixed width up to the exchange, given only for the sides that moved. */
function headerLine(state, me, { toi, robot }, { bot, look }) {
  const moves = [toi ? `U:${moveCode(toi, look)}` : "", robot ? `${tagOf(bot)}:${moveCode(robot, look)}` : ""].filter(Boolean);
  const exchange = moves.length > 0 ? [moves.join(" ─ ")] : [];
  const pile = state.pile.length === 0 ? "--" : twoDigits(state.pile.length);
  return [`TURN:${twoDigits(state.turn + 1)}`, `DECK:${pile}`, `OHAND:${state.hands[1 - me].length}`, ...exchange].join(" | ");
}
