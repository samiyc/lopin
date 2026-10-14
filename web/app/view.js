import { FORMATION_LABELS } from "../../src/config/formations.js";
import { colorOf, isJoker, valueOf } from "../../src/core/cards.js";
import { figureOf, isFigure } from "../../src/core/figures.js";
import { formatCard } from "../../src/core/notation.js";
import { formatMinutes } from "./clock.js";

/**
 * From a game snapshot (`snapshot()` in `src/replay/log.js`) to what the
 * page draws. Pure, so what the player sees is tested under Node:
 *
 * - `bottom` is the seat drawn at the bottom (the human, or seat 1 of the
 *   first bot when observing); the stones read green or red from its side;
 * - `reveal` shows both hands (observer, replays) or hides the top one;
 * - `handOrder` and `topOrder` are the order each hand is shown in (the
 *   player's own, or `followHands` in the replay player);
 * - `shown` is how many borders settled at the end to show: the end of a
 *   game reveals them one by one, in the order they filled. A border claimed
 *   during the game (`claimedAt`) is always shown, from the move it was
 *   claimed at;
 * - `suits` counts, suit by suit, the cards the bottom player can see.
 */
const RED_SUITS = new Set(["♥", "♦"]);

/**
 * Suit indices with black and red alternating — ♠ ♥ ♣ ♦ for the classic
 * deck — so two suits of one ink never sit side by side.
 */
export function suitOrder(spec) {
  const colors = spec.suits.map((_, color) => color);
  const blacks = colors.filter((color) => !RED_SUITS.has(spec.suits[color]));
  const reds = colors.filter((color) => RED_SUITS.has(spec.suits[color]));
  return Array.from({ length: Math.max(blacks.length, reds.length) }, (_, i) => [blacks[i], reds[i]])
    .flat()
    .filter((color) => color !== undefined);
}

/**
 * For each suit, in `suitOrder`, then the jokers: how many of its cards the
 * bottom player can see — both sides of the board, their own hand, and the
 * other hand when it is revealed — out of how many the deck holds.
 */
export function suitCounts(spec, snap, { bottom, reveal }) {
  const hands = reveal ? snap.hands : [snap.hands[bottom]];
  const cards = [...snap.borders.flatMap((border) => border.sides.flat()), ...hands.flat()];
  const seen = cards.filter((card) => !isJoker(card));
  const suits = suitOrder(spec).map((color) => {
    const suit = spec.suits[color];
    return { suit, label: suit, red: RED_SUITS.has(suit), seen: seen.filter((card) => colorOf(spec, card) === color).length, total: spec.values };
  });
  if (!spec.jokers) return suits;
  return [...suits, { suit: "joker", label: "JK", red: false, seen: cards.filter(isJoker).length, total: spec.jokers }];
}

export function cardView(spec, card) {
  if (isJoker(card)) return { id: card, text: "JK", value: "JK", suit: "★", red: false, joker: true };
  if (isFigure(card)) return figureView(card);
  const suit = spec.suits[colorOf(spec, card)];
  return { id: card, text: formatCard(spec, card), value: String(valueOf(spec, card)), suit, red: RED_SUITS.has(suit), joker: false };
}

/** An extension figure (figures.js): « V♣ » shown as a court card, its rule as a title. */
function figureView(card) {
  const figure = figureOf(card);
  const suit = figure.text.slice(-1);
  return { id: card, text: figure.text, value: figure.text.slice(0, -1), suit, red: RED_SUITS.has(suit), joker: false, figure: true, title: `${figure.name} : ${figure.rule}` };
}

const figureOn = (border, seat) => (border.figures?.[seat] ? figureView(border.figures[seat]) : null);

function stoneOf(resolved, bottom) {
  if (!resolved) return { state: "neutral", toward: null };
  const mine = resolved.winner === bottom;
  return { state: mine ? "won" : "lost", toward: mine ? "bottom" : "top" };
}

function borderView(spec, snap, index, context) {
  const { bottom, visible, justRevealed, lastMove } = context;
  const top = 1 - bottom;
  const border = snap.borders[index];
  const resolved = visible.find((entry) => entry.border === index) ?? null;
  return {
    index,
    number: index + 1,
    top: border.sides[top].map((card) => cardView(spec, card)),
    bottom: border.sides[bottom].map((card) => cardView(spec, card)),
    // The figures laid beside each side (the extension), null for none.
    figures: { top: figureOn(border, top), bottom: figureOn(border, bottom) },
    stone: stoneOf(resolved, bottom),
    animate: resolved !== null && resolved === justRevealed,
    formations: resolved
      ? { top: FORMATION_LABELS[resolved.formations[top]], bottom: FORMATION_LABELS[resolved.formations[bottom]] }
      : null,
    lastMove: lastMove !== null && lastMove.border === index,
  };
}

function resultView(snap, bottom, complete) {
  if (!snap.over || !complete) return null;
  if (snap.winner === null) return { outcome: "draw", winType: snap.winType };
  return { outcome: snap.winner === bottom ? "bottom" : "top", winType: snap.winType };
}

const DEFAULTS = Object.freeze({ bottom: 0, reveal: false, handOrder: null, topOrder: null, shown: Infinity, lastMove: null });

function topHand(spec, snap, seat, { reveal, topOrder }) {
  const cards = reveal ? (topOrder ?? snap.hands[seat]).map((card) => cardView(spec, card)) : [];
  return { seat, hidden: !reveal, count: snap.hands[seat].length, cards };
}

const isClaimed = (entry) => entry.claimedAt !== undefined;

/** The borders settled when the game ended, revealed one by one. */
export const settledAtEnd = (snap) => snap.resolved.filter((entry) => !isClaimed(entry));

function bottomHand(spec, snap, seat, handOrder) {
  return { seat, cards: (handOrder ?? snap.hands[seat]).map((card) => cardView(spec, card)) };
}

/** `{ turn, over, pile, current, top, bottom, borders, suits, result }` for `snap`. */
export function tableView(spec, snap, options) {
  const { bottom, reveal, handOrder, topOrder, shown, lastMove } = { ...DEFAULTS, ...options };
  const showAll = Boolean(snap.openHands || reveal);
  const claimed = snap.resolved.filter(isClaimed);
  const revealed = settledAtEnd(snap).slice(0, shown);
  const visible = [...claimed, ...revealed];
  const justRevealed = revealed.at(-1) ?? claimed.findLast((entry) => entry.claimedAt === snap.turn) ?? null;
  const context = { bottom, visible, justRevealed, lastMove };
  return {
    turn: Math.min(snap.turn + 1, 42),
    over: snap.over,
    pile: snap.pile,
    current: snap.current === bottom ? "bottom" : "top",
    top: topHand(spec, snap, 1 - bottom, { reveal: showAll, topOrder }),
    bottom: bottomHand(spec, snap, bottom, handOrder),
    borders: snap.borders.map((_, index) => borderView(spec, snap, index, context)),
    suits: suitCounts(spec, snap, { bottom, reveal: showAll }),
    result: resultView(snap, bottom, visible.length === snap.resolved.length),
  };
}

/** "24/09/26 à 01h57", read from the log's own local timestamp. */
function shortDate(stamp) {
  const [, year, month, day, hour, minute] = /^\d\d(\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(stamp) ?? [];
  return year ? `${day}/${month}/${year} à ${hour}h${minute}` : stamp;
}

function outcomeOf(header) {
  const human = header.players.find((player) => player.kind === "human");
  if (!human || header.winner === null) return null;
  return header.winner === human.seat ? "won" : "lost";
}

function modeLabel(bonus) {
  if (!bonus) return "Standard";
  if (bonus === 1) return "Extension (1 bonus)";
  return `Extension (${bonus} bonus)`;
}

/** The mode, and « CLI » after it for a game played in the terminal (Sami, 14/10): the page writes no client. */
const playedLabel = ({ bonus, client }) => (client === "cli" ? `${modeLabel(bonus)} · CLI` : modeLabel(bonus));

/**
 * A replay list entry on three lines. `title`: both players, first player first,
 * "(W)" on the winner's side. `detail`: score and mode ("Standard" or "Extension (X bonus)", « · CLI » for the terminal).
 * `sub`: duration and date. `outcome`: "won" or "lost" for the human, null for bots.
 */
export function replayLabel(header, nameOf) {
  const [first, second] = [...header.players].sort((a, b) => a.seat - b.seat).map(nameOf);
  const title = `${header.winner === 0 ? "(W) " : ""}${first} -vs- ${second}${header.winner === 1 ? " (W)" : ""}`;
  const how = header.winType === "adjacent" ? "3 bornes connectées" : header.borders && `Score:${header.borders.join("-")}`;
  const detail = [how, playedLabel(header)].filter(Boolean).join(". ");
  const time = header.durationMs ? `Durée:${formatMinutes(header.durationMs).replace(" ", "")}` : null;
  const sub = [time, shortDate(header.startedAt)].filter(Boolean).join(". ");
  return { title, detail, sub, outcome: outcomeOf(header) };
}

export const WIN_TYPES = Object.freeze({
  adjacent: "trois bornes côte à côte",
  majority: "quatre bornes",
  exhaustion: "le plus de bornes",
  draw: "égalité",
});
