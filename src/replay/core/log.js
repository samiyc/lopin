import { DECKS, JOKER_RULES } from "../../config/decks.js";
import { ORDERS } from "../../config/formations.js";
import { isJoker } from "../../core/cards.js";
import { drawsAfter } from "../../core/figures.js";
import { bySuitThenValue, formatCard, formatCards, parseCard, parseCards } from "../../core/notation.js";
import { applyMove, createGame, legalMoves } from "../../sim/engine/game.js";
import { parseSeat } from "../../sim/engine/seat-rules.js";

/**
 * Replay logs: everything that happened in a game, in plain JSON, cards
 * written "7♥". A log carries the full deck order, so `replayStates` can
 * rebuild the game move by move — and refuses a log whose moves are not legal
 * or whose draws do not match.
 *
 * Borders are numbered 1 to 7 in a log, as players count them; 0-based in
 * the engine.
 */
export const REPLAY_FORMAT = "lopin-replay/1";
const CANDIDATES_KEPT = 5;

/** `rules`: ids, e.g. `{ deck: "classique", jokerRule: "colorless", order: "original", endMode: "final" }`. */
export function rulesOf(rules) {
  return {
    spec: DECKS[rules.deck],
    order: ORDERS[rules.order],
    jokerRule: JOKER_RULES[rules.jokerRule],
    endMode: rules.endMode,
  };
}

/** "2026-09-23T21:47:39+02:00": local time with its offset, so replay names read like the clock. */
export function localTimestamp(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offset * 60000).toISOString().slice(0, 19);
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  return `${local}${offset >= 0 ? "+" : "-"}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

export function startLog(state, { rules, players, seed, startedAt = localTimestamp() }) {
  return {
    format: REPLAY_FORMAT,
    startedAt,
    endedAt: null,
    rules,
    players,
    seed,
    deck: formatCards(state.spec, state.deck),
    turns: [],
    result: null,
  };
}

function sideContext(state, player, border) {
  const target = state.borders[border];
  const [mine, theirs] = [target.sides[player], target.sides[1 - player]];
  return {
    mine: formatCards(state.spec, mine),
    theirs: formatCards(state.spec, theirs),
    wasEmpty: mine.length === 0,
    completes: mine.length === 2,
    theirsFull: theirs.length === 3,
  };
}

/** A search's `kept` best moves with their gains: 5 on the page, 12 in a duel's replay (bot-games.js). */
export function candidatesOf(spec, scored, kept = CANDIDATES_KEPT) {
  if (!scored) return null;
  return [...scored]
    .sort((a, b) => b.gain - a.gain)
    .slice(0, kept)
    .map(({ move, gain }) => ({ card: formatCard(spec, move.card), border: move.border + 1, gain: Number(gain.toFixed(4)) }));
}

/**
 * What a bot's search leaves in its move: its best candidates, and for a tree bot the tree by level (tree-stats.js,
 * Sami 14/10: nodes, with 0 and 1 visit, the most visits — is depth 5 to 10 used?).
 */
function searchOf(spec, scored) {
  return { candidates: candidatesOf(spec, scored), ...(scored?.tree ? { tree: scored.tree } : {}) };
}

/**
 * Applies `move` (or a pass, `null`) to `state` and appends the turn to `log`.
 * `scored` is the bot's `scoreMoves` output, kept as its best candidates.
 */
export function playLogged(log, state, move, scored = null) {
  const { spec } = state;
  const player = state.current;
  const entry = {
    turn: state.turn + 1,
    player,
    hand: formatCards(spec, [...state.hands[player]].sort(bySuitThenValue(spec))),
    pile: state.pile.length,
  };
  if (move === null) {
    applyMove(state, null);
    // The entry logged is the one returned: a copy lost the caller's `thinkMs` / `note`, and the CLI read a pass
    // without `pass` as a move (llm-play, 13/10: a model with no legal move crashed the step).
    entry.pass = true;
    log.turns.push(entry);
    return entry;
  }
  Object.assign(entry, {
    // `target`: the border a Dame de Cœur swaps with (the extension); `discard`: Valet de Trèfle.
    move: {
      card: formatCard(spec, move.card),
      border: move.border + 1,
      ...(move.target === undefined ? {} : { target: move.target + 1 }),
      ...(move.discard === undefined ? {} : { discard: formatCard(spec, move.discard) }),
    },
    side: sideContext(state, player, move.border),
    joker: isJoker(move.card),
    ...searchOf(spec, scored),
  });
  const drawing = state.pile.length > 0 && drawsAfter(move.card, move);
  applyMove(state, move);
  const hand = state.hands[player];
  entry.drew = drawing ? formatCard(spec, hand[hand.length - 1]) : null;
  log.turns.push(entry);
  return entry;
}

export function finishLog(log, state, endedAt = localTimestamp()) {
  const { spec } = state;
  log.endedAt = endedAt;
  log.result = {
    winner: state.winner,
    winType: state.winType,
    borders: state.resolved.map((entry) => ({
      border: entry.border + 1,
      sides: state.borders[entry.border].sides.map((side) => formatCards(spec, side)),
      formations: entry.formations,
      sums: entry.sums,
      winner: entry.winner,
      decidedBy: entry.decidedBy,
      filledAt: entry.filledAt === null ? null : entry.filledAt + 1,
      ...(entry.claimedAt === undefined ? {} : { claimedAt: entry.claimedAt }),
    })),
  };
  return log;
}

/** What the page draws and the replay stores: a plain copy, no evaluator. */
export function snapshot(state) {
  return {
    turn: state.turn,
    current: state.current,
    pile: state.pile.length,
    openHands: Boolean(state.openHands),
    hands: state.hands.map((hand) => [...hand]),
    borders: state.borders.map((border) => ({ sides: border.sides.map((side) => [...side]), owner: border.owner, figures: border.figures ? [...border.figures] : [null, null] })),
    resolved: state.resolved.map((entry) => ({ ...entry })),
    winner: state.winner,
    winType: state.winType,
    over: state.over,
  };
}

/** A logged move read back: 1-based borders, and the swap's `target` or minusTen's `discard` (the extension). */
const loggedMove = (spec, logged, drew = null) => ({
  card: parseCard(spec, logged.card),
  border: logged.border - 1,
  ...(logged.target === undefined ? {} : { target: logged.target - 1 }),
  ...(logged.discard === undefined ? {} : { discard: parseCard(spec, logged.discard) }),
  ...(logged.card === "V♣" && logged.discard !== undefined && drew !== null ? { legacy: true } : {}),
});

function replayTurn(state, entry, index) {
  const fail = (why) => {
    throw new Error(`Replay invalide au tour ${index + 1} : ${why}`);
  };
  if (entry.player !== state.current) fail(`c'était au joueur ${state.current + 1}`);
  if (entry.pass) {
    if (legalMoves(state).length > 0) fail("passe alors qu'un coup était possible");
    applyMove(state, null);
    return;
  }
  const move = loggedMove(state.spec, entry.move, entry.drew);
  if (!legalMoves(state).some((m) => m.card === move.card && m.border === move.border && m.target === move.target && m.discard === move.discard)) fail(`coup illégal ${entry.move.card} → ${entry.move.border}`);
  const drawing = state.pile.length > 0 && drawsAfter(move.card, move);
  applyMove(state, move);
  const hand = state.hands[entry.player];
  if (drawing && formatCard(state.spec, hand[hand.length - 1]) !== entry.drew) fail(`pioche différente (${entry.drew})`);
}

const NO_OPINION = Object.freeze({ advice: null, adviceGap: null, refused: false });

/**
 * A second opinion on a logged move: the advisor bot's best candidates, and
 * `adviceGap`, how much less the advisor rates the move actually played than
 * its best (0 when the move was one of its best). A move the advisor refuses
 * to consider at all (the strategist's joker off a pair) has no gap to
 * measure: `refused` says so instead.
 */
function adviceFor(state, advisor, entry) {
  const moves = legalMoves(state);
  if (!advisor || moves.length === 0 || !entry.move) return NO_OPINION;
  const scored = advisor.scoreMoves(state, moves, { keepAll: true });
  const considered = scored.filter((candidate) => !candidate.refused);
  const advice = candidatesOf(state.spec, considered);
  const played = scored.find(({ move }) => formatCard(state.spec, move.card) === entry.move.card && move.border === entry.move.border - 1);
  if (!played || played.refused) return { advice, adviceGap: null, refused: Boolean(played) };
  const best = Math.max(...considered.map((candidate) => candidate.gain));
  return { advice, adviceGap: Math.max(0, best - played.gain), refused: false };
}

/** The game as a log was dealt: its rules, deck and seed, open hands, and a seat compensation (seat-rules.js). */
function dealtGame(log) {
  const { spec, order, jokerRule, endMode } = rulesOf(log.rules);
  return createGame(spec, { order, jokerRule, endMode, deck: parseCards(spec, log.deck), rng: null, seed: log.seed, openHands: Boolean(log.rules?.openHands), seat: parseSeat(log.rules?.seat) });
}

/**
 * Every state of a logged game: `frames[0]` is the deal, `frames[i]` the
 * table after turn `i`, with the turn's log entry attached. With an
 * `advisor` bot, each human move also gets that bot's opinion (`advice`,
 * `adviceGap`): how it is weighed in the replay viewer and the summary.
 */
export function replayStates(log, { advisor = null } = {}) {
  if (log.format !== REPLAY_FORMAT) throw new Error(`Format de replay inconnu : ${log.format}`);
  const state = dealtGame(log);
  const frames = [{ state: snapshot(state), entry: null, ...NO_OPINION }];
  log.turns.forEach((entry, index) => {
    const opinion = entry.candidates ? NO_OPINION : adviceFor(state, advisor, entry);
    replayTurn(state, entry, index);
    frames.push({ state: snapshot(state), entry, ...opinion });
  });
  return frames;
}

/**
 * The live game just before logged turn `turn` (1-based) is played: what the
 * player to move had in front of them. Unlike `replayStates`' snapshots it
 * carries the evaluator, so a bot can be asked what it would play there — the
 * strategy tests replay Sami's reported positions this way.
 */
export function stateAt(log, turn) {
  const state = dealtGame(log);
  log.turns.slice(0, turn - 1).forEach((entry, index) => replayTurn(state, entry, index));
  return state;
}
