import { BOT_LINEUP } from "../../../src/config/bots.js";
import { $, el, toast } from "../board/dom.js";
import { analysisCommands } from "./lab-text.js";
import { pathOf } from "./replay-paths.js";

/**
 * « Garder pour analyse » (the Labo, lot 3): a note on the move on show (`entry.note`, saved with the game when it is
 * saved; read only in a replay), and the commands that take the position further in Node (`npm run position`, the
 * two bots' long duel), to copy — nothing goes to the backlog by itself.
 *
 * The note's box is one element kept from draw to draw: the panel is redrawn while a bot thinks, and a new box would
 * lose the text being typed and the focus.
 */
const keep = { entry: null, box: null, commands: "" };

function noteBox(entry, editable) {
  keep.box ??= el("textarea", { id: "lab-note", rows: 2, maxlength: 500, placeholder: "Une note sur ce coup, gardée dans le replay quand tu enregistres la partie" });
  if (keep.entry !== entry || document.activeElement !== keep.box) keep.box.value = entry.note ?? "";
  keep.box.readOnly = !editable;
  keep.entry = entry;
  return keep.box;
}

/** A seat's engine id, or null for a human. */
const engineOf = (player) => (player?.kind === "bot" ? (player.engine ?? BOT_LINEUP[player.bot]?.engine ?? player.bot) : null);

/** The section for the decision on show: `{ log, turn, entry, mover, editable }`. */
export function keepSection({ log, turn, entry, mover, editable }) {
  const commands = analysisCommands({ path: pathOf(log), turn, mover, engines: log.players.map(engineOf), oracle: BOT_LINEUP["oracle-light"].engine });
  keep.commands = commands.join("\n");
  const note = editable || entry.note ? noteBox(entry, editable) : null;
  return el(
    "section",
    { class: "lab-replay lab-keep" },
    el("h3", {}, "Garder pour analyse"),
    note,
    el("pre", { class: "lab-commands" }, keep.commands),
    el("div", { class: "lab-replay-go" }, el("button", { type: "button", class: "quiet", id: "btn-lab-copy" }, "Copier les commandes"), pathOf(log) ? null : el("span", { class: "hint" }, "« Enregistrer cette partie » d'abord, pour que la commande trouve le replay.")),
  );
}

export function wireKeep() {
  $("lab-view").addEventListener("input", (event) => {
    if (event.target.id === "lab-note" && keep.entry && !event.target.readOnly) keep.entry.note = event.target.value;
  });
  $("lab-view").addEventListener("click", async (event) => {
    if (!event.target.closest("#btn-lab-copy")) return;
    try {
      await navigator.clipboard.writeText(keep.commands);
      toast("Commandes copiées.");
    } catch {
      toast("Copie impossible : sélectionne le texte à la main.");
    }
  });
}
