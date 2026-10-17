import { formatThinking } from "../board/clock.js";
import { $, el } from "../board/dom.js";
import { playerName } from "./runner.js";

/**
 * The "why this move" panel of the observer and the replays: the hand, the
 * move and the border it went to, and the bot's best candidates — or, for a
 * human move, what the Stratège 2.1 would have played: its best moves and the
 * one played, each judged on the same 16 simulated endgames
 * (`src/replay/advice.js`, computed by a worker while the replay is open).
 */
const gain = (value) => value.toFixed(3).replace(".", ",");
const rate = (value) => `${Math.round(100 * value)} %`;

function sideText(side) {
  const mine = side.wasEmpty ? "borne vide" : `sa ligne : ${side.mine.join(" ")}`;
  const theirs = side.theirs.length === 0 ? "rien en face" : `en face : ${side.theirs.join(" ")}`;
  return `${mine} ; ${theirs}${side.completes ? " — il la complète" : ""}`;
}

function candidateList(title, candidates, move) {
  if (!candidates || candidates.length === 0) return [];
  // A duel's replay keeps 12 candidates; the panel shows the first 5.
  const items = candidates.slice(0, 5).map((c) => {
    const chosen = move && c.card === move.card && c.border === move.border;
    return el("li", { class: chosen ? "chosen" : "" }, `${c.card} → borne ${c.border} · ${gain(c.gain)}`);
  });
  return [el("p", {}, title), el("ol", {}, ...items)];
}

function adviceVerdict({ advice, adviceGap, refused, playedRate }) {
  if (refused) return "Le Stratège 2.1 ne pose jamais un joker hors d'une paire : pas d'écart mesurable.";
  if (adviceGap === null || adviceGap === undefined) return null;
  if (adviceGap < 1e-9) return `Même choix que le Stratège 2.1 (${rate(playedRate)} des fins de partie simulées gagnées).`;
  const [best] = advice;
  return `Le Stratège 2.1 préférait ${best.card} → borne ${best.border} : ${rate(best.gain)} des fins de partie simulées gagnées, contre ${rate(playedRate)} pour ton coup.`;
}

/** The judged moves, with their share of endgames won rather than a core score. */
function adviceList(advice, move) {
  if (!advice || advice.length === 0) return [];
  const items = advice.map((c) => el("li", { class: move && c.card === move.card && c.border === move.border ? "chosen" : "" }, `${c.card} → borne ${c.border} · ${rate(c.gain)}`));
  return [el("p", {}, "Le Stratège 2.1 aurait joué (fins de partie simulées gagnées, sur 16) :"), el("ol", {}, ...items)];
}

function adviceParts(frame, move) {
  if (frame.advicePending) return [el("p", { class: "hint" }, "Le Stratège 2.1 réfléchit…")];
  // The worker answers with an empty list when there was a single move to play: nothing to weigh.
  if (Array.isArray(frame.advice) && frame.advice.length === 0 && !frame.refused) return [el("p", { class: "hint" }, "Un seul coup possible : rien à comparer pour le Stratège 2.1.")];
  const verdict = adviceVerdict(frame);
  return [...(verdict ? [el("p", {}, verdict)] : []), ...adviceList(frame.advice, move)];
}

export function renderExplain(log, frame) {
  const box = $("explain");
  const entry = frame?.entry;
  if (!entry) {
    box.replaceChildren(el("p", {}, "Début de partie : les deux mains viennent d'être distribuées."));
    return;
  }
  const who = playerName(log.players[entry.player]);
  const parts = [el("h3", {}, `Tour ${entry.turn} — ${who}`), el("p", {}, `Main : ${entry.hand.join(" ")}`)];
  if (entry.pass) {
    parts.push(el("p", {}, "Passe : aucun coup possible."));
  } else {
    const took = typeof entry.thinkMs === "number" ? ` en ${formatThinking(entry.thinkMs)}` : "";
    parts.push(el("p", {}, `Joue ${entry.move.card} sur la borne ${entry.move.border}${took} (${sideText(entry.side)}).`));
    parts.push(el("p", {}, entry.drew ? `Pioche : ${entry.drew}` : "Pioche vide."));
  }
  parts.push(...candidateList("Ses meilleures options :", entry.candidates, entry.move));
  parts.push(...adviceParts(frame, entry.move));
  box.replaceChildren(...parts);
}
