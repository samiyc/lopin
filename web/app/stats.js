import { BOT_LINEUP } from "../../src/config/bots.js";
import { FORMATIONS, FORMATION_LABELS } from "../../src/config/formations.js";
import { $, el } from "./dom.js";
import { fetchStats } from "./replays-api.js";

/**
 * The "Stats" tab: the Elo table, then each human's record against each bot
 * version (wins, seats, time), then wins by starting hand, then which formations won the borders — all
 * from the saved games (`/api/stats`, `src/replay/stats.js`).
 */
const pct = (part, whole) => (whole ? `${Math.round((100 * part) / whole)} %` : "—");
const name = (player) => {
  const [id, version] = player.split("@");
  return version ? `${BOT_LINEUP[id]?.label ?? id} ${version}` : player;
};
const minutes = (ms) => (ms ? `${Math.round(ms / 60000)} min` : "—");
const seconds = (ms) => (ms ? `${Math.round(ms / 1000)} s` : "—");

function table(headers, rows) {
  return el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...headers.map((h) => el("th", {}, h)))), el("tbody", {}, ...rows)));
}

function eloBlock(elo) {
  const top = Math.max(...elo.map((row) => row.elo + row.margin));
  const rows = elo.map((row) => {
    const [id, version] = row.player.split("@");
    const vs = BOT_LINEUP[id]?.version === version && BOT_LINEUP[id]?.vsLower ? ` (${BOT_LINEUP[id].vsLower})` : "";
    return el(
      "tr",
      { class: row.human ? "human" : "" },
      el("td", {}, name(row.player), vs ? el("small", { class: "facts" }, ` ${vs}`) : null),
      el("td", { class: "num" }, String(row.games)),
      el("td", { class: "bar-cell" }, el("span", { class: "bar", style: `width:${(100 * (row.elo - 400)) / (top - 400)}%` })),
      el("td", { class: "num" }, String(row.elo)),
      el("td", { class: "num" }, `±${row.margin}`),
    );
  });
  // Sami, 14/10: the games first, the bar right before the Elo it draws.
  return [el("h3", {}, "Classement Elo"), table(["Joueur", "Parties", "", "Elo", "Marge"], rows), el("p", { class: "hint" }, "Basique = 500. Tes parties et les duels entre robots, en un seul ajustement (npm run elo).")];
}

function recordBlock(lines) {
  const rows = lines
    .sort((a, b) => b.games - a.games)
    .map((line) =>
      el(
        "tr",
        {},
        el("td", {}, `${line.human} contre ${name(line.opponent)}`),
        el("td", { class: "num" }, String(line.games)),
        el("td", { class: "num" }, `${line.won} (${pct(line.won, line.games)})`),
        el("td", { class: "num" }, `${line.first.won}/${line.first.games}`),
        el("td", { class: "num" }, `${line.second.won}/${line.second.games}`),
        el("td", { class: "num" }, minutes(line.timedGames && line.activeMs / line.timedGames)),
        el("td", { class: "num" }, seconds(line.timedMoves && line.thinkMs / line.timedMoves)),
      ),
    );
  return [el("h3", {}, "Tes parties"), table(["Match", "Parties", "Gagnées", "En premier", "En second", "Durée", "Réflexion / coup"], rows)];
}

function formationBlock(formations) {
  const totals = { human: Object.values(formations.human).reduce((a, b) => a + b, 0), bot: Object.values(formations.bot).reduce((a, b) => a + b, 0) };
  const rows = FORMATIONS.map((formation) =>
    el(
      "tr",
      {},
      el("td", {}, FORMATION_LABELS[formation]),
      ...["human", "bot"].map((side) => el("td", { class: "bar-cell" }, el("span", { class: `bar ${side}`, style: `width:${totals[side] ? (100 * formations[side][formation]) / totals[side] : 0}%` }), el("span", { class: "num" }, ` ${pct(formations[side][formation], totals[side])}`))),
    ),
  );
  return [el("h3", {}, "Les combinaisons qui gagnent les bornes"), table(["Combinaison", `Toi (${totals.human} bornes)`, `Robots (${totals.bot} bornes)`], rows)];
}

const HAND_HEADERS = { weak: "Main faible", medium: "Moyenne", strong: "Main forte" };

/** Games and wins by starting hand: do weak hands lose and strong ones win, for you and for each bot? */
function handsBlock(hands = []) {
  const cell = ({ games, won }) => el("td", { class: "num" }, games ? `${won}/${games} (${pct(won, games)})` : "—");
  const rows = hands.map((row) => el("tr", { class: row.human ? "human" : "" }, el("td", {}, name(row.player)), ...Object.keys(HAND_HEADERS).map((id) => cell(row[id]))));
  const hint = "Gagnées / parties, selon la main de départ de chacun. Faible : pas de joker ni de départ, au plus une paire, somme ≤ 36 (≈ 10 % des mains). Forte : un départ et une somme ≥ 44 (≈ 9 %).";
  return [el("h3", {}, "Mains de départ"), table(["Joueur", ...Object.values(HAND_HEADERS)], rows), el("p", { class: "hint" }, hint)];
}

export async function renderStats() {
  const view = $("stats-view");
  try {
    const { elo, lines, formations, hands } = await fetchStats();
    view.replaceChildren(el("h2", {}, "Statistiques"), ...eloBlock(elo), ...recordBlock(lines), ...handsBlock(hands), ...formationBlock(formations));
  } catch (error) {
    view.replaceChildren(el("p", { class: "hint" }, `Statistiques indisponibles (${error.message}). La page est-elle servie par npm run play ?`));
  }
}
