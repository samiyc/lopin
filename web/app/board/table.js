import { $, el } from "./dom.js";
import { WIN_TYPES } from "../replays/view.js";

/**
 * Draws the table from a view (`view.js`). Everything is redrawn on each
 * change: the table holds 48 cards at most, and a full redraw keeps the page
 * and the game state from drifting apart. Input is handled by `drag.js`,
 * through event delegation, so redraws do not lose it.
 */
const SUIT_NAMES = { "♠": "pique", "♥": "cœur", "♦": "carreau", "♣": "trèfle", joker: "joker" };

/**
 * A card shows its value and suit in the top-left corner — the part that
 * stays visible when cards overlap on a border — and its suit, large, in the
 * other corner. Hovering a stacked card lifts it whole (CSS).
 */
function cardFace(card) {
  if (card.figure) return [el("span", { class: "corner" }, el("span", { class: "v" }, card.value), el("span", { class: "cs" }, card.suit)), el("span", { class: "s" }, card.value)];
  if (card.joker) return [el("span", { class: "corner" }, el("span", { class: "v" }, "JK")), el("span", { class: "j" }, "JOKER")];
  const corner = el("span", { class: "corner" }, el("span", { class: "v" }, card.value), el("span", { class: "cs" }, card.suit));
  return [corner, el("span", { class: "s" }, card.suit)];
}

/** What a screen reader says of a card: its rule for a figure (the extension). */
function labelOf(card) {
  if (card.figure) return card.title;
  return card.joker ? "joker" : `${card.value} de ${SUIT_NAMES[card.suit]}`;
}

const KINDS = ["red", "joker", "figure"];

export function cardElement(card, attrs = {}) {
  const label = labelOf(card);
  const classes = ["card", ...KINDS.filter((kind) => card[kind]), attrs.class ?? ""].filter(Boolean).join(" ");
  const dataset = { ...attrs.dataset, suit: card.joker ? "joker" : card.suit };
  return el("div", { ...attrs, dataset, class: classes, "aria-label": label }, ...cardFace(card));
}

const backElement = () => el("div", { class: "card back", "aria-hidden": "true" });

function renderTopHand(hand) {
  const cards = hand.hidden ? Array.from({ length: hand.count }, backElement) : hand.cards.map((card) => cardElement(card));
  $("hand-top").replaceChildren(...cards);
}

function renderBottomHand(hand, { interactive, selected, marks }) {
  const cards = hand.cards.map((card, index) =>
    cardElement(card, {
      class: [index === selected ? "selected" : "", marks.discard.has(card.id) ? "discardable" : ""].filter(Boolean).join(" "),
      draggable: interactive ? "true" : null,
      tabindex: interactive ? "0" : null,
      role: interactive ? "button" : null,
      dataset: { index, card: card.id },
    }),
  );
  $("hand-bottom").replaceChildren(...cards);
}

/** A side's cards: the last one played ringed, and the one a selected Dame de Pique would take back lit (`recalled`). */
function sideElement(cards, position, border, { legal, lastMove, premove = false, recalled = false }) {
  const classOf = (i) => {
    if (i !== cards.length - 1) return "";
    return [lastMove && position === lastMove ? "last" : "", recalled ? "recallable" : ""].filter(Boolean).join(" ");
  };
  const drawn = cards.map((card, i) => cardElement(card, { class: classOf(i) }));
  const classes = ["side", position, legal ? "drop-ok" : "", premove ? "premove" : ""].filter(Boolean).join(" ");
  return el("div", { class: classes, dataset: { border: border.index, position } }, ...drawn);
}

function stoneElement(border) {
  const classes = ["stone", border.stone.state, border.animate ? "animate" : ""].filter(Boolean).join(" ");
  const titles = { neutral: `Borne ${border.number}`, won: `Borne ${border.number} gagnée`, lost: `Borne ${border.number} perdue` };
  return el("div", { class: classes, title: titles[border.stone.state] }, String(border.number));
}

/** A side with, to its right, the figure laid beside it (the extension), small. */
function sideRow(side, figure) {
  if (!figure) return side;
  return el("div", { class: "side-row" }, side, cardElement(figure, { class: "small", title: figure.title }));
}

function borderElement(border, { legalBorders, lastMove, premove, marks }) {
  const legal = legalBorders.has(border.index);
  const lastSide = border.lastMove ? lastMove.side : null;
  const recalled = marks.recall.has(border.index);
  return el(
    "div",
    { class: "border", dataset: { border: border.index } },
    el("p", { class: "formation" }, border.formations?.top ?? ""),
    sideRow(sideElement(border.top, "top", border, { legal: false, lastMove: lastSide }), border.figures?.top),
    stoneElement(border),
    sideRow(sideElement(border.bottom, "bottom", border, { legal, lastMove: lastSide, premove: premove === border.index, recalled }), border.figures?.bottom),
    el("p", { class: "formation" }, border.formations?.bottom ?? ""),
  );
}

const SUIT_HINT = "Maintenir pour surligner ces cartes. Compte : les cartes de cette couleur visibles (plateau et main).";

/** The ♠ ♥ ♣ ♦ buttons: built once, so a redraw never interrupts a press. */
function renderSuitBar(suits) {
  const bar = $("suit-bar");
  bar.hidden = false;
  if (bar.children.length !== suits.length) {
    bar.replaceChildren(...suits.map(({ suit, red }) => el("button", { type: "button", class: red ? "red" : "", dataset: { suit }, title: SUIT_HINT })));
  }
  suits.forEach(({ suit, label, seen, total }, i) => {
    const button = bar.children[i];
    const icon = suit === "joker" ? label : el("span", { class: "sym" }, label);
    button.replaceChildren(icon, ` ${seen}/${total}`);
    button.setAttribute("aria-label", `${SUIT_NAMES[suit] ?? suit} : ${seen} cartes vues sur ${total}`);
  });
}

const highlight = (suit) => {
  if (suit) $("table").dataset.highlight = suit;
  else delete $("table").dataset.highlight;
};

/** Holding a suit button (pointer, Enter or Space) lights that suit's cards. */
export function wireSuitBar() {
  const bar = $("suit-bar");
  const suitOf = (event) => (event.target instanceof Element ? event.target.closest("button")?.dataset.suit : undefined);
  bar.addEventListener("pointerdown", (event) => {
    const suit = suitOf(event);
    if (!suit) return;
    event.target.setPointerCapture?.(event.pointerId);
    highlight(suit);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) bar.addEventListener(type, () => highlight(null));
  // Pressing ♥ right after ♠ moves the focus from one button to the other just
  // after ♥'s pointerdown lit it: only focus leaving the bar puts the light out.
  bar.addEventListener("focusout", (event) => {
    if (!bar.contains(event.relatedTarget)) highlight(null);
  });
  bar.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && suitOf(event)) {
      event.preventDefault();
      highlight(suitOf(event));
    }
  });
  bar.addEventListener("keyup", () => highlight(null));
}

/** The pile, greyed out once empty: the last cards are the ones in hand. */
function renderPile(pile) {
  $("deck").classList.toggle("empty", pile === 0);
  $("pile-text").replaceChildren(...(pile === 0 ? ["Pioche vide"] : [el("strong", {}, String(pile)), pile === 1 ? " carte" : " cartes"]));
}

function renderCounters(view, status) {
  renderPile(view.pile);
  $("turn").textContent = view.over ? "Partie terminée" : `Tour ${view.turn}`;
  $("status").textContent = status;
}

function renderBanner(result, names) {
  const banner = $("banner");
  if (!result) {
    banner.hidden = true;
    return;
  }
  const texts = { bottom: `${names.bottom} gagne`, top: `${names.top} gagne`, draw: "Égalité" };
  banner.className = `banner ${{ bottom: "won", top: "lost", draw: "" }[result.outcome]}`;
  banner.replaceChildren(texts[result.outcome], el("small", {}, `par ${WIN_TYPES[result.winType] ?? result.winType}`));
  banner.hidden = false;
}

/** An empty table with a message: no game in this tab yet, or one abandoned. */
export function clearTable(message) {
  for (const id of ["hand-top", "board", "hand-bottom", "label-top", "label-bottom"]) $(id).replaceChildren();
  $("sorters").hidden = true;
  $("suit-bar").hidden = true;
  const pass = $("btn-pass");
  if (pass) pass.hidden = true;
  highlight(null);
  $("banner").hidden = true;
  $("status").textContent = message;
  $("turn").textContent = "";
  $("deck").classList.remove("empty");
  $("pile-text").textContent = "";
}

const NO_MARKS = Object.freeze({ recall: new Set(), discard: new Set() });

/**
 * `options`: `{ status, names: { top, bottom }, interactive, selected,
 * legalBorders: Set, lastMove: { border, side } | null, marks, showTools }`.
 * `marks` (the extension): `recall`, the borders whose bottom card a selected
 * Dame de Pique would take back; `discard`, the card ids a Valet de Trèfle may discard.
 */
export function renderTable(view, options) {
  const settings = { interactive: false, selected: null, legalBorders: new Set(), lastMove: null, showTools: false, canPass: false, ...options };
  settings.marks ??= NO_MARKS;
  renderCounters(view, settings.status);
  $("label-top").textContent = settings.names.top;
  $("label-bottom").textContent = settings.names.bottom;
  renderTopHand(view.top);
  renderBottomHand(view.bottom, settings);
  $("board").replaceChildren(...view.borders.map((border) => borderElement(border, settings)));
  renderSuitBar(view.suits);
  $("sorters").hidden = !settings.showTools;
  const pass = $("btn-pass");
  if (pass) pass.hidden = !settings.canPass;
  renderBanner(view.result, settings.names);
}
