import { formatCard } from "../../../src/core/notation.js";
import { borderTones, cardTones } from "./confidence.js";

/**
 * The Labo's words and marks (Sami, 17/10), PURE: how a move, a line of play or a rate is written, which decision a
 * position shows, what of a worker's report a replay keeps, and the table's colours for one decision.
 */
export const percent = (value) => (value === null || value === undefined ? "—" : `${Math.round(100 * value)} %`);

/** « 7♥ → 3 », or « passe ». `move`: `{ card, border }` with the card's id and the 0-based border. */
export const moveName = (spec, move) => (move ? `${formatCard(spec, move.card)} → ${move.border + 1}` : "passe");

/** A snapshot key (`moveKey`: "12@3", "pass") or the « +n » node, written. */
export function keyName(spec, key) {
  if (key === "pass") return "passe";
  if (key === "+" || key === "root") return key === "+" ? "autres" : "position";
  const [card, border] = key.split("@").map(Number);
  return moveName(spec, { card, border });
}

/** A line of play from the root, « Basique joue 7♥ → 3, puis Stratège 5♠ → 2, … ». `names`: by seat. */
export function lineText(spec, path, names) {
  return path.map((node, index) => `${index === 0 ? "" : "puis "}${names[node.mover]} ${keyName(spec, node.key)}`).join(", ");
}

/**
 * The decision a position shows: at frame `index` (the table after `index` moves) the player to move thinks about the
 * next move, so its report is the next entry's. `{ entry, lab, turn }` or null at the end of the game.
 */
export function decisionAt(frames, index, labs = new Map()) {
  const next = frames[index + 1];
  if (!next?.entry) return null;
  const turn = index + 1;
  return { entry: next.entry, lab: labs.get(turn) ?? next.entry.lab ?? null, turn };
}

/** What a replay keeps of a worker's report: the root's candidates and each tree's levels, not the trees themselves. */
export function compactLab(lab) {
  if (!lab) return null;
  if (lab.exact) return { exact: true };
  return { root: lab.root, levels: lab.trees.map((tree) => tree.levels) };
}

/** A kept report read back as the panel reads a live one (`trees` without snapshots). */
export const expandLab = (lab) => (lab?.levels ? { root: lab.root, trees: lab.levels.map((levels) => ({ levels, snapshot: null })) } : lab);

const NONE = Object.freeze({ recall: new Set(), discard: new Set() });

/**
 * The table's colours for one decision: each card of the mover's hand by its best candidate (`tones`), and, for the
 * card looked at (`focus`, a card id), the borders it goes to (`sides`, on the mover's side: seat 0 is drawn below).
 * `played`: the move made, or null while the bot still thinks (the most visited is the reference then).
 */
export function labMarks({ root, played, hand, mover, focus = null }) {
  if (!root || root.length === 0) return NONE;
  const tones = new Map([...cardTones(root, played, hand)].map(([card, { tone }]) => [card, tone]));
  if (focus === null) return { ...NONE, tones };
  const sides = new Map([...borderTones(root, played, focus)].map(([border, entry]) => [border, { tone: entry.tone, label: percent(entry.rate) }]));
  return { ...NONE, tones, sides: { position: mover === 0 ? "bottom" : "top", tones: sides } };
}
