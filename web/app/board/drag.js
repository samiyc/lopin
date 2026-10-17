import { $ } from "./dom.js";

/**
 * Input on the table, by event delegation (the table is redrawn often):
 *
 * - drag a card of the bottom hand onto a border's bottom side to play it;
 * - drag it onto another card of the hand to put it there;
 * - or click a card, then a border — or press 1 to 7 — and Escape to let go.
 *
 * `controller`: `{ enabled(), selected(), select(index|null), play(grip,
 * border), reorder(grip, to), legalFor(index) → Set of borders }`. A `grip`
 * is `{ index, card }`: the card id travels with its index, so the page can
 * check the card is still where it was picked up.
 *
 * The card being dragged lives here, never in `dataTransfer`: a drop whose
 * drag did not start on the hand (selected text, a file, another tab) carries
 * data too, and `Number("")` is 0 — the first card of the hand.
 */
let dragged = null;

const handCard = (target) => (target instanceof Element ? target.closest(".hand.bottom .card") : null);

const handIndex = (target) => {
  const card = handCard(target);
  return card ? Number(card.dataset.index) : null;
};

const gripOf = (target) => {
  const card = handCard(target);
  return card ? { index: Number(card.dataset.index), card: Number(card.dataset.card) } : null;
};

const bottomSide = (target) => (target instanceof Element ? target.closest(".border")?.querySelector(".side.bottom") ?? null : null);

function markDropZones(legal) {
  document.querySelectorAll(".side.bottom").forEach((side) => {
    side.classList.toggle("drop-ok", legal.has(Number(side.dataset.border)));
  });
}

/** Forgets any drag in progress: on dragend, and whenever a game starts or ends. */
export function clearDrag() {
  dragged = null;
  document.querySelectorAll(".dragging, .drop-target").forEach((node) => node.classList.remove("dragging", "drop-target"));
  markDropZones(new Set());
}

function onDragStart(event, controller) {
  const grip = gripOf(event.target);
  if (grip === null || !controller.enabled()) return event.preventDefault();
  dragged = grip;
  // Firefox starts no drag without data; the page never reads it back.
  event.dataTransfer.setData("text/plain", "");
  event.dataTransfer.effectAllowed = "move";
  handCard(event.target).classList.add("dragging");
  markDropZones(controller.legalFor(grip.index));
  return undefined;
}

function onDragOver(event) {
  if (dragged === null) return;
  const side = bottomSide(event.target);
  const overCard = handIndex(event.target) !== null;
  if ((side && side.classList.contains("drop-ok")) || overCard) {
    event.preventDefault();
    side?.classList.add("drop-target");
  }
}

function onDrop(event, controller) {
  event.preventDefault();
  const grip = dragged;
  const side = bottomSide(event.target);
  const to = handIndex(event.target);
  clearDrag();
  if (grip === null) return;
  if (side) controller.play(grip, Number(side.dataset.border));
  else if (to !== null) controller.reorder(grip, to);
}

function onClick(event, controller) {
  if (!controller.enabled()) return;
  const index = handIndex(event.target);
  if (index !== null) return controller.select(controller.selected() === index ? null : index);
  const border = event.target.closest(".border");
  const selected = controller.selected();
  if (border && selected !== null) controller.play({ index: selected }, Number(border.dataset.border));
  return undefined;
}

/** Enter or Space on a focused card of the hand selects it. */
function selectFocused(event, controller) {
  const focused = handIndex(event.target);
  if ((event.key !== "Enter" && event.key !== " ") || focused === null) return;
  event.preventDefault();
  controller.select(focused);
}

/** 1 to 7 plays the selected card on that border, when it may go there. */
function playOnDigit(event, controller) {
  const selected = controller.selected();
  const border = Number(event.key) - 1;
  if (selected === null || !Number.isInteger(border) || border < 0 || border > 6) return;
  controller.play({ index: selected }, border);
}

function onKey(event, controller) {
  if (!controller.enabled() || event.target.closest("input, select, dialog")) return;
  if (event.key === "Escape") controller.select(null);
  selectFocused(event, controller);
  playOnDigit(event, controller);
}

export function setupInput(controller) {
  const table = $("table");
  table.addEventListener("dragstart", (event) => onDragStart(event, controller));
  table.addEventListener("dragover", onDragOver);
  table.addEventListener("dragleave", (event) => bottomSide(event.target)?.classList.remove("drop-target"));
  table.addEventListener("drop", (event) => onDrop(event, controller));
  table.addEventListener("dragend", clearDrag);
  table.addEventListener("click", (event) => onClick(event, controller));
  document.addEventListener("keydown", (event) => onKey(event, controller));
}
