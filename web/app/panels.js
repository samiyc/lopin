import { BOT_IDS, BOT_LINEUP, DEFAULT_OPPONENT } from "../../src/config/bots.js";
import { $, el, freshSeed, toast } from "./dom.js";
import { keepReplay, listReplays, loadReplay, saveReplay } from "./replays-api.js";
import { generateBotGame, playerName } from "./runner.js";
import { clearTable } from "./table.js";
import { createThinker } from "./thinker.js";
import { replayLabel } from "./view.js";
import { currentLog, load, loaded, pause } from "./viewer.js";

/**
 * The "Observer" and "Replays" panels. Both feed the same viewer: an
 * observer game is generated whole, then played back like a saved one.
 */
function fillBotSelect(select, chosen) {
  select.replaceChildren(...BOT_IDS.map((id) => el("option", { value: id, selected: id === chosen }, `${BOT_LINEUP[id].label} ${BOT_LINEUP[id].version}`)));
}

function seedFromInput() {
  const typed = Number.parseInt($("observe-seed").value, 10);
  const seed = Number.isInteger(typed) && typed >= 0 ? typed : freshSeed();
  $("observe-seed").value = String(seed);
  return seed;
}

export function wireObserve() {
  fillBotSelect($("observe-bottom"), DEFAULT_OPPONENT);
  fillBotSelect($("observe-top"), "basique");
  $("btn-observe").addEventListener("click", async () => {
    const button = $("btn-observe");
    button.disabled = true;
    pause();
    clearTable("Les robots jouent…");
    try {
      const onTurn = (turn) => {
        $("status").textContent = `Les robots jouent… tour ${turn} / 42`;
      };
      const thinkerFor = (id, player, seed) => createThinker(player, BOT_LINEUP[id].think, seed);
      const log = await generateBotGame($("observe-bottom").value, $("observe-top").value, seedFromInput(), { onTurn, thinkerFor });
      load(log, { autoplay: true });
    } finally {
      button.disabled = false;
    }
  });
  $("btn-observe-save").addEventListener("click", async () => {
    if (!loaded()) return toast("Lance d'abord une partie.");
    try {
      toast(`Partie enregistrée : ${(await saveReplay(currentLog())).path}`);
    } catch (error) {
      toast(`Enregistrement impossible : ${error.message}`);
    }
    return undefined;
  });
}

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
