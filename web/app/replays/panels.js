import { $, el, toast } from "../board/dom.js";
import { keepReplay, listReplays, loadReplay } from "./replays-api.js";
import { playerName } from "./runner.js";
import { replayLabel } from "./view.js";
import { load } from "./viewer.js";

/**
 * The "Replays" panel: the saved games, played back in the shared viewer. The Observer became the Labo
 * (lab/lab-game.js, 17/10), which plays its games live in the same viewer.
 */

/** Three lines: who played (and who won), score and mode, then duration and date. Green or red for the human. */
function replayButton(header) {
  const { title, detail, sub, outcome } = replayLabel(header, playerName);
  const hint = [title, detail, sub].filter(Boolean).join("\n");
  return el(
    "button",
    { type: "button", class: outcome, title: hint, dataset: { name: header.name, dir: header.dir } },
    el("span", { class: "replay-title" }, title),
    el("span", { class: "replay-detail" }, detail),
    el("span", { class: "replay-detail" }, sub),
  );
}

function group(title, headers) {
  const items = headers.length > 0 ? headers.map(replayButton) : [el("p", { class: "hint" }, "Aucune partie.")];
  return [el("h3", {}, title), ...items];
}

function markCurrent(header) {
  document.querySelectorAll("#replay-list button").forEach((button) => {
    const current = button.dataset.name === header.name && button.dataset.dir === header.dir;
    button.setAttribute("aria-current", String(current));
  });
}

export function wireReplays() {
  let headers = [];
  let current = null;
  const open = async (header) => {
    current = header;
    load(await loadReplay(header.dir, header.name));
    $("btn-keep").hidden = header.dir !== "recent";
    markCurrent(header);
  };
  const refresh = async () => {
    try {
      const { recent, kept } = await listReplays();
      headers = [...recent, ...kept];
      $("replay-list").replaceChildren(...group("Récentes", recent), ...group("Gardées pour l'analyse", kept));
      if (current) markCurrent(current);
    } catch (error) {
      $("replay-list").replaceChildren(el("p", { class: "hint" }, `Liste indisponible (${error.message}). La page est-elle servie par npm run play ?`));
    }
  };
  $("replay-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-name]");
    const header = button && headers.find((h) => h.name === button.dataset.name && h.dir === button.dataset.dir);
    if (header) open(header);
  });
  $("btn-keep").addEventListener("click", async () => {
    if (!current) return;
    toast(`Replay gardé : ${(await keepReplay(current.name)).path}`);
    refresh();
  });
  return { refresh };
}
