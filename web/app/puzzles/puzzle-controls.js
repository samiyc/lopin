import { $, recall, remember } from "../board/dom.js";
import { buttonsFor, statusLine, toggleFavorite } from "./puzzle-kinds.js";

/**
 * The puzzle panel's own controls (Sami, 03/10): favourites kept in the
 * browser by puzzle id, like the solved ones, and the id copied to talk about
 * a puzzle without a screenshot.
 */
const FAVORITES_KEY = "lopin.puzzles.favorites";

export const favoriteIds = () => new Set(JSON.parse(recall(FAVORITES_KEY, "[]")));

export function flipFavorite(id) {
  remember(FAVORITES_KEY, JSON.stringify(toggleFavorite(favoriteIds(), id)));
}

/** Copies "Puzzle #id"; says so in `note`, or shows the text to copy by hand when the clipboard refuses. */
export async function copyId(id, note) {
  const text = `Puzzle #${id}`;
  try {
    await navigator.clipboard.writeText(text);
    note.textContent = `« ${text} » copié.`;
  } catch {
    note.textContent = `À copier : ${text}`;
  }
}

/** The star, the buttons that stand out (green) and the status line, from where the puzzle stands. */
export function renderStatus(current, status) {
  const favorite = favoriteIds().has(current.id);
  $("btn-puzzle-star").textContent = favorite ? "★ Favori" : "☆ Favori";
  $("btn-puzzle-star").setAttribute("aria-pressed", String(favorite));
  const stand = buttonsFor(status);
  $("btn-puzzle-next").classList.toggle("quiet", !stand.next);
  $("btn-puzzle-reveal").classList.toggle("quiet", !stand.reveal);
  $("btn-puzzle-retry").classList.toggle("quiet", !stand.retry);
  const line = statusLine(status);
  const element = $("puzzle-status");
  element.hidden = !line;
  element.className = line ? `puzzle-status ${line.tone}` : "puzzle-status";
  element.textContent = line?.text ?? "";
}
