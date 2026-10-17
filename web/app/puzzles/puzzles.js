import { formatCard, parseCard } from "../../../src/core/notation.js";
import { snapshot, stateAt } from "../../../src/replay/core/log.js";
import { applyMove, legalMoves } from "../../../src/sim/engine/game.js";
import { createRng } from "../../../src/core/random.js";
import { $, freshSeed, recall, remember } from "../board/dom.js";
import { sortBySuit, syncOrder } from "../board/hand.js";
import { copyId, favoriteIds, flipFavorite, renderStatus } from "./puzzle-controls.js";
import { attemptLine, attemptMove, attemptReveal, beginAttempt, endAttempt, loadAttempts, timeNote } from "./puzzle-tracker.js";
import { countIn, favoritesOnly, unsolvedOnly, hintOf, immediateMessage, isImmediate, kindLabel, namesOf, openingMessage, puzzleStatus, randomOrder, solutionOf } from "./puzzle-kinds.js";
import { SPEC } from "../replays/runner.js";
import { clearTable, renderTable } from "../board/table.js";
import { tableView } from "../replays/view.js";

/**
 * "Puzzles": endgames with an empty pile, where every card is known and the
 * end is solved exactly (`src/sim/eval/endgame.js`, in `solve-worker.js`). The
 * human plays the side to move against a perfect opponent; every move is
 * judged against the solution. Puzzles come from `npm run puzzles`
 * (web/data/puzzles.json); the solved ones are remembered in the browser.
 */
const SOLVED_KEY = "lopin.puzzles.solved";
const puzzle = { list: [], index: 0, order: [], cursor: 0, game: null, visible: false, worker: null, requests: 0 };

/**
 * A random order, the puzzles not yet solved first: the next one is never
 * predictable. Kept to the favourites, then to the unsolved ones, when those
 * boxes are ticked; the unsolved filter comes last so that favourites all
 * solved still show rather than unrelated puzzles.
 */
function shuffleOrder() {
  const solved = solvedIds();
  const order = randomOrder(puzzle.list, solved, createRng(freshSeed()));
  const favorites = $("puzzle-favorites-only").checked ? favoritesOnly(order, puzzle.list, favoriteIds()) : order;
  puzzle.order = $("puzzle-unsolved-only").checked ? unsolvedOnly(favorites, puzzle.list, solved) : favorites;
  puzzle.cursor = 0;
}

function next() {
  puzzle.cursor += 1;
  if (puzzle.cursor >= puzzle.order.length) shuffleOrder();
  start(puzzle.order[puzzle.cursor]);
}

const text = (move) => `${formatCard(SPEC, move.card)}→${move.border + 1}`;
const solvedIds = () => new Set(JSON.parse(recall(SOLVED_KEY, "[]")));

/** Asks the worker for the exact values of every move in the current position. */
function solve() {
  const { game } = puzzle;
  const id = (puzzle.requests += 1);
  const log = { ...game.log, turns: [...game.log.turns, ...game.played] };
  return new Promise((resolve) => {
    const listen = ({ data }) => {
      if (data.id !== id) return;
      puzzle.worker.removeEventListener("message", listen);
      resolve(data.moves);
    };
    puzzle.worker.addEventListener("message", listen);
    puzzle.worker.postMessage({ id, log });
  });
}

const humanTurn = () => puzzle.game && !puzzle.game.state.over && puzzle.game.state.current === puzzle.game.mover && !puzzle.game.thinking;

function legalFor(index) {
  if (!humanTurn()) return new Set();
  const card = puzzle.game.order[index];
  return new Set(legalMoves(puzzle.game.state).filter((move) => move.card === card).map((move) => move.border));
}

export function render() {
  const { game } = puzzle;
  if (!puzzle.visible || !game) return;
  const current = puzzle.list[puzzle.index];
  const view = tableView(SPEC, snapshot(game.state), { bottom: game.mover, reveal: !isImmediate(current), handOrder: game.order, lastMove: game.lastMove });
  renderTable(view, {
    status: game.message,
    names: namesOf(current),
    interactive: humanTurn(),
    selected: game.selected,
    legalBorders: game.selected === null ? new Set() : legalFor(game.selected),
    lastMove: game.lastMove,
  });
  $("puzzle-kind").textContent = hintOf(current);
  $("puzzle-title").textContent = `Puzzle #${current.id} · ${kindLabel(current)} · ${current.moves} coups possibles${attemptLine(current.id)}`;
  $("puzzle-solved").textContent = `Résolus : ${countIn(puzzle.list, solvedIds())} / ${puzzle.list.length} · favoris : ${countIn(puzzle.list, favoriteIds())}`;
  renderStatus(current, puzzleStatus(game.result));
}


/** Plays `move` on the puzzle board and logs it, so the worker can rebuild the position. */
function play(move) {
  const { game } = puzzle;
  const player = game.state.current;
  game.played.push({ turn: game.state.turn + 1, player, move: { card: formatCard(SPEC, move.card), border: move.border + 1 }, drew: null });
  applyMove(game.state, move);
  game.order = syncOrder(game.order, game.state.hands[game.mover]);
  game.lastMove = { border: move.border, side: player === game.mover ? "bottom" : "top" };
  game.selected = null;
}

/** A pass, logged too: the worker rebuilds positions from the log. */
function pass(game) {
  game.played.push({ turn: game.state.turn + 1, player: game.state.current, pass: true });
  applyMove(game.state, null);
}

const markSolved = () => remember(SOLVED_KEY, JSON.stringify([...solvedIds(), puzzle.list[puzzle.index].id]));

/** A "gain immédiat" ends on its first move: the win is proved, not played out. */
function settleImmediate(slip) {
  const { game } = puzzle;
  if (!slip && !game.revealed) markSolved();
  game.result = { won: !slip, helped: game.revealed };
  game.message = immediateMessage(slip, game.revealed) + timeNote(endAttempt(!slip));
  render();
}

function finish() {
  const { game } = puzzle;
  const won = game.state.winner === game.mover;
  const closed = endAttempt(won);
  if (won && !game.slipped && !game.revealed) markSolved();
  const helped = game.slipped || game.revealed;
  game.result = { won, helped };
  if (!won) game.message = "Perdu. Recommence ce puzzle, ou révèle le coup gagnant.";
  else game.message = (helped ? "Gagné, mais avec de l'aide." : "Résolu ! Puzzle suivant ?") + timeNote(closed);
  render();
}

/** The opponent's perfect move, or a pass when it has none. */
async function opponentMove(game) {
  const [best] = await solve();
  if (puzzle.game !== game) return;
  if (best) play({ card: parseCard(SPEC, best.card), border: best.border - 1 });
  else pass(game);
}

/** The opponent replies perfectly, then the human's next position is solved. */
async function reply() {
  const { game } = puzzle;
  game.thinking = true;
  game.message = "L'adversaire calcule…";
  render();
  if (!game.state.over) await opponentMove(game);
  if (puzzle.game !== game) return;
  // A human with nothing left to play passes, and the opponent goes again.
  if (!game.state.over && legalMoves(game.state).length === 0) {
    pass(game);
    return reply();
  }
  if (!game.state.over) game.solution = await solve();
  if (puzzle.game !== game) return;
  game.thinking = false;
  if (game.state.over) return finish();
  game.message = "À toi.";
  return render();
}

function judge(move) {
  const { game } = puzzle;
  const best = Math.max(...game.solution.map((entry) => entry.value));
  const mine = game.solution.find((entry) => entry.card === formatCard(SPEC, move.card) && entry.border === move.border + 1);
  if (mine && mine.value < best) {
    game.slipped = true;
    const winners = game.solution.filter((entry) => entry.value === best).map((entry) => `${entry.card}→${entry.border}`);
    attemptMove(text(move), false, winners);
    const verdict = isImmediate(puzzle.list[puzzle.index]) ? "ne gagne pas à coup sûr" : "ne gagne plus";
    return `Faux pas : ${text(move)} ${verdict}. Il fallait ${winners.join(" ou ")}.`;
  }
  attemptMove(text(move), true);
  return null;
}

export const puzzleInput = {
  enabled: () => puzzle.visible && humanTurn(),
  selected: () => puzzle.game?.selected ?? null,
  select(index) {
    puzzle.game.selected = index;
    render();
  },
  play({ index, card }, border) {
    const { game } = puzzle;
    const at = card === undefined ? index : game.order.indexOf(card);
    if (at === -1 || !legalFor(at).has(border)) return;
    const move = { card: game.order[at], border };
    const slip = judge(move);
    play(move);
    if (isImmediate(puzzle.list[puzzle.index])) return settleImmediate(slip);
    return reply().then(() => {
      if (slip && !game.state.over) {
        game.message = slip;
        render();
      }
    });
  },
  reorder() {},
  legalFor,
};

export function start(index) {
  const current = puzzle.list[index];
  const state = stateAt(current.log, current.turn);
  puzzle.index = index;
  beginAttempt(current);
  puzzle.game = { state, log: current.log, mover: state.current, played: [], order: sortBySuit(SPEC, state.hands[state.current]), selected: null, lastMove: null, thinking: false, slipped: false, revealed: false };
  puzzle.game.solution = solutionOf(current, legalMoves(state), text);
  puzzle.game.message = openingMessage(current);
  $("puzzle-copied").textContent = "";
  render();
}

function reveal() {
  const { game } = puzzle;
  // Once the puzzle is over (lost, most often), the winning move is the one from its starting position.
  if (game?.result) {
    game.message = `Coup gagnant au départ : ${puzzle.list[puzzle.index].solutions.join(" ou ")}.`;
    return render();
  }
  if (!game || !humanTurn()) return;
  const best = Math.max(...game.solution.map((entry) => entry.value));
  game.revealed = true;
  attemptReveal();
  const winners = game.solution.filter((entry) => entry.value === best).map((entry) => entry.card + " → borne " + entry.border);
  game.message = `Coup gagnant : ${winners.join(", ou ")}.`;
  render();
}

export async function showPuzzles(visible) {
  puzzle.visible = visible;
  if (!visible) return;
  if (puzzle.list.length === 0) {
    const response = await fetch("/web/data/puzzles.json").catch(() => null);
    puzzle.list = response?.ok ? (await response.json()).puzzles : [];
    await loadAttempts();
  }
  if (puzzle.list.length === 0) return clearTable("Aucun puzzle : lance npm run puzzles.");
  if (!puzzle.game) {
    shuffleOrder();
    return start(puzzle.order[0]);
  }
  return render();
}

export function wirePuzzles() {
  puzzle.worker = new Worker(new URL("../workers/solve-worker.js", import.meta.url), { type: "module" });
  $("btn-puzzle-reveal").addEventListener("click", reveal);
  $("btn-puzzle-retry").addEventListener("click", () => start(puzzle.index));
  $("btn-puzzle-next").addEventListener("click", next);
  $("btn-puzzle-star").addEventListener("click", () => {
    flipFavorite(puzzle.list[puzzle.index].id);
    render();
  });
  $("btn-puzzle-copy").addEventListener("click", () => copyId(puzzle.list[puzzle.index].id, $("puzzle-copied")));
  // Either filter: a new draw, and a move to the first puzzle kept unless the current one is.
  for (const id of ["puzzle-unsolved-only", "puzzle-favorites-only"]) {
    $(id).addEventListener("change", () => {
      shuffleOrder();
      if (puzzle.game && !puzzle.order.includes(puzzle.index)) start(puzzle.order[0]);
      else render();
    });
  }
}
