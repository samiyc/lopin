import { BOT_IDS, BOT_LINEUP, DEFAULT_OPPONENT } from "../../../src/config/bots.js";
import { $, el, openDialog, recall, remember } from "../board/dom.js";
import { fetchElo } from "../replays/replays-api.js";

/** One bot to choose: its name and version, then what it does in figures. */
function opponentChoice(id) {
  const bot = BOT_LINEUP[id];
  const facts = el("small", { class: "facts" }, `${bot.description} · ${bot.examines} · ${bot.pace}`, el("span", { id: `elo-${id}` }));
  return el("label", { class: "opponent" }, el("input", { type: "radio", name: "opponent", value: id, checked: id === DEFAULT_OPPONENT }), el("b", {}, ` ${bot.label} ${bot.version}`), facts);
}

/** Each bot's Elo from the saved games (`/api/elo`), when the server can tell. */
async function showElo() {
  const table = await fetchElo().catch(() => []);
  for (const id of BOT_IDS) {
    const row = table.find((entry) => entry.player === `${id}@${BOT_LINEUP[id].version}`);
    if (row) {
      const vs = BOT_LINEUP[id].vsLower ? ` (${BOT_LINEUP[id].vsLower})` : "";
      $(`elo-${id}`).textContent = ` · Elo ${row.elo}${vs}`;
    }
  }
}

/**
 * The "Nouvelle partie" and "Recommencer" dialogs of the "Jouer" panel.
 * `game`: `{ start({ first, opponent, name }), abandon(), active() }`.
 */
export function wireGameDialogs(game) {
  $("opponents").append(...BOT_IDS.map(opponentChoice));
  showElo();
  $("player-name").value = recall("lopin.name", "Joueur");
  $("bonus-count").value = recall("lopin.bonus", "0");
  $("open-hands").checked = false;
  try {
    localStorage.removeItem("lopin.open");
  } catch {
    // Private window or blocked storage.
  }
  const dialog = $("dialog-new");
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "start") return;
    const form = new FormData($("form-new"));
    const name = String(form.get("name") ?? "").trim() || "Joueur";
    const openHands = Boolean(form.get("open"));
    remember("lopin.name", name);
    remember("lopin.bonus", String(form.get("bonus") ?? "0"));
    game.start({ first: form.get("first"), opponent: form.get("opponent"), name, bonus: Number(form.get("bonus") ?? 0), openHands });
  });
  $("btn-new").addEventListener("click", () => {
    $("open-hands").checked = false;
    openDialog(dialog);
  });
  const confirm = $("dialog-reset");
  $("btn-reset").addEventListener("click", () => openDialog(game.active() ? confirm : dialog));
  confirm.addEventListener("close", () => {
    if (confirm.returnValue !== "reset") return;
    game.abandon();
    $("open-hands").checked = false;
    openDialog(dialog);
  });
}
