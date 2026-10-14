import { parentPort } from "node:worker_threads";
import { formatCard } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { stateAt } from "../../src/replay/log.js";
import { contextsOf, traitsOf } from "../../src/replay/move-features.js";
import { ORACLE, coreRanking, needsSecondRun, oracleOf, rankOf, verdictOf } from "../../src/replay/oracle.js";
import { engineFor, strategistBot } from "../../src/sim/bots.js";
import { EXPERIMENT, coreOf } from "../../src/sim/experimental.js";
import { legalMoves } from "../../src/sim/game.js";
import { loadGame } from "./game-index.js";

/**
 * One position for the oracle (`scripts/oracle.js`): the core's ranking of
 * every legal move, the oracle's favourite in two runs of different seeds,
 * and the traits of the oracle's move and of the core's favourite.
 */
function seedOf(text, run) {
  let hash = 0x811c9dc5 ^ run;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

const labelOf = (spec, move) => `${formatCard(spec, move.card)}→${move.border + 1}`;
/** The move the game's bot played there, as the replay writes it. */
const loggedLabel = (entry) => (entry?.move ? `${entry.move.card}→${entry.move.border}` : null);

const opensSide = (state, mover, move) => state.borders[move.border].sides[mover].length === 0;

/** One run of the oracle, or two when the first finds a move outside the core's top 3 — or always `runs` when asked. */
function oracleRuns(state, moves, { key, budget, ranking, runs, engine }) {
  const search = (run) => engineFor(`${engine}@${budget}`)(createRng(seedOf(key, run))).scoreMoves(state, moves, { keepAll: true });
  const first = search(1);
  const second = runs ? runs >= 2 : needsSecondRun(ranking, first);
  return second ? [first, search(2)] : [first];
}

/** The core's ranking of every legal move: the 0.9's, or `rank`'s (`--rank stfig6`). */
const rankingAt = (state, moves, rank) => coreRanking(strategistBot(createRng(1), rank ? coreOf(rank) : EXPERIMENT).scoreMoves(state, moves, { keepAll: true }));

/** Each search's `keep` most visited moves and their share of its visits (`--keep 12`): the oracle's whole opinion, for the bench (banc.js). */
function visitsOf(spec, searched, keep) {
  if (!keep) return {};
  const top = (scored) => {
    const total = scored.reduce((sum, entry) => sum + entry.gain, 0) || 1;
    return [...scored].sort((a, b) => b.gain - a.gain).slice(0, keep).map(({ move, gain }) => ({ move: labelOf(spec, move), share: Number((gain / total).toFixed(4)) }));
  };
  return { visits: searched.map(top) };
}

parentPort.on("message", async ({ row, turn, budget, runs, rank, keep, at, oracle: version }) => {
  const started = Date.now();
  const oracle = oracleOf(version);
  const log = await loadGame(row);
  const state = stateAt(log, turn);
  const moves = state.over ? [] : legalMoves(state);
  const base = { key: row.key, file: row.file, game: row.game, turn, at, oracle: oracle.version };
  if (moves.length <= 1) return parentPort.postMessage({ ...base, skipped: true });
  const { spec } = state;
  const mover = state.current;
  const hand = [...state.hands[mover]];
  const ranking = rankingAt(state, moves, rank);
  const searched = oracleRuns(state, moves, { key: `${row.key}|${turn}`, budget, ranking, runs, engine: oracle.engine });
  const verdict = verdictOf(ranking, searched);
  const played = loggedLabel(log.turns[turn - 1]);
  const playedRank = ranking.findIndex((move) => labelOf(spec, move) === played) + 1;
  return parentPort.postMessage({
    ...base,
    mover,
    starter: mover === log.turns[0].player,
    legal: moves.length,
    ...verdict,
    move: labelOf(spec, verdict.move),
    other: searched[1] ? labelOf(spec, verdictOf(ranking, [searched[1]]).move) : null,
    core: ranking.slice(0, ORACLE.top).map((move) => labelOf(spec, move)),
    played,
    playedRank,
    oracleRankOfCore: rankOf(coreRanking(searched[0]), ranking[0]),
    // Does the move put a first card on one of the mover's empty sides?
    opens: { oracle: opensSide(state, mover, verdict.move), core: opensSide(state, mover, ranking[0]) },
    traits: { oracle: traitsOf(state, mover, hand, verdict.move), core: traitsOf(state, mover, hand, ranking[0]) },
    contexts: contextsOf(state, mover, row.handClasses?.[mover] ?? "medium", turn),
    ...visitsOf(spec, searched, keep),
    ms: Date.now() - started,
  });
});
