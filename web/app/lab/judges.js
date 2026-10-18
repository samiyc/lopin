import { BOT_LINEUP } from "../../../src/config/bots.js";
import { ORACLES } from "../../../src/replay/oracle/oracle.js";
import { exactApplies } from "../../../src/sim/eval/exact.js";
import { sameMove } from "./lab-text.js";

/**
 * « L'avis des juges » (the Labo, lot 3), PURE: who judges the move on show, and what their search says of it.
 *
 * - The oracles judge the decision, with what the bot could know: the Oracle light 1.0 (the line-up's, two trees of
 *   5 000) and Oracle3 at 20 000 (`ORACLES[3]`, docs/strategie/06-les-oracles.md).
 * - The omniscient judges the deal (Sami, 18/10): the 1.2's tree with `+omniscient=1` plays every iteration on the true
 *   deal, both hands and the pile seen, and its solver counts the pile (`exact=14`). It says which move won with
 *   these cards; a move both reject was badly chosen, a move only it rejects lost to the hidden cards.
 * - The exact solver, once the pile is empty and 12 cards or fewer are left: the unseen cards are then the opponent's
 *   hand, so its verdict on every move is the truth.
 */
export const JUDGES = Object.freeze([
  { id: "oracle-light", label: "Oracle light 1.0", engine: BOT_LINEUP["oracle-light"].engine, cost: "≈ 5 s sur deux fils", kind: "oracle" },
  { id: "oracle3", label: "Oracle3", engine: `${ORACLES[3].engine}@${ORACLES[3].budget}`, cost: "20 000 itérations, ≈ 30 s", kind: "oracle" },
  { id: "omniscient", label: "Omniscient 1.0", engine: "ismcts+widen=7+depth=5+core=stfig6+exact=14+omniscient=1@2000", cost: "≈ 3 s, voit les deux mains et la pioche", kind: "omniscient" },
]);

export const SOLVER_CARDS = 12;

/** Does the exact solver judge this position (pile empty, 12 cards or fewer in the hands)? */
export const solverJudges = (state) => !state.over && exactApplies(state, SOLVER_CARDS);

const keyOf = (move) => (move ? `${move.card}@${move.border}` : "pass");
const VALUE_WORDS = { 1: "gagne", 0: "fait nul", "-1": "perd" };

/** A searched move's exact value (1, 0, -1) when the solver examined it, else null. */
const exactValue = (entry) => (entry?.exact ? Math.round(entry.gain) : null);

/** The solver's word for an examined move, or « non examiné » (it stops at the first win). */
export const valueWord = (value) => (value === null || value === undefined ? "non examiné" : VALUE_WORDS[value]);

/**
 * A judge's reply read against the move played: `{ chosen, same, best, played, exact }`.
 * - `best`: its most visited candidate `{ move, share, rate }`;
 * - `played`: the move played among its candidates `{ rank, share, rate }` (rank by visits, 1 the most visited), or null;
 * - `exact`: when its solver answered instead of its tree, `{ played, winning }`, the played move's value and how many
 *   moves it proved winning.
 */
export function judgeSummary(reply, played) {
  if (!reply) return null;
  const same = sameMove(reply.move, played);
  if (reply.lab?.exact) return { chosen: reply.move, same, best: null, played: null, exact: exactOf(reply.scored ?? [], played) };
  return { chosen: reply.move, same, ...treeOf(reply.lab?.root ?? [], played), exact: null };
}

/** The solver's side of a reply: the played move's value, the moves proved winning. */
function exactOf(scored, played) {
  const entry = scored.find((move) => keyOf(move.move) === keyOf(played));
  return { played: exactValue(entry), winning: scored.filter((move) => exactValue(move) === 1).length };
}

/** The tree's side of a reply: its favourite and the move played among its candidates. */
function treeOf(candidates, played) {
  const root = [...candidates].sort((a, b) => b.visits - a.visits);
  const total = root.reduce((sum, entry) => sum + entry.visits, 0) || 1;
  const view = (entry) => ({ move: entry.move, share: entry.visits / total, rate: entry.rate });
  const rank = root.findIndex((entry) => entry.key === keyOf(played));
  return { best: root[0] ? view(root[0]) : null, played: rank < 0 ? null : { rank: rank + 1, ...view(root[rank]) } };
}

/** The solver worker's answer (`[{ card: "7♥", border: 3, value }]`, best first) read against the move played (`{ card: "7♥", border: 3 }`). */
export function solverSummary(moves, played) {
  const entry = moves.find((move) => played && move.card === played.card && move.border === played.border);
  const best = moves[0]?.value ?? null;
  return { played: entry?.value ?? null, best, winning: moves.filter((move) => move.value === 1), drawing: moves.filter((move) => move.value === 0).length, moves: moves.length };
}
