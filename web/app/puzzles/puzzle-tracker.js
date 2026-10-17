import { closeAttempt, createAttempt, noteMove, noteReveal } from "../../../src/replay/stats/puzzle-attempts.js";
import { createClock, formatThinking, watchFocus } from "../board/clock.js";
import { fetchPuzzleAttempts, savePuzzleAttempt } from "../replays/replays-api.js";
import { recall, remember } from "../board/dom.js";

/**
 * The puzzle attempts of the page (src/replay/stats/puzzle-attempts.js): one at a
 * time, timed by a clock that stops when the page loses focus, sent to the
 * play server when it ends. An attempt the server could not take waits in the
 * browser and goes with the next one.
 */
const PENDING_KEY = "lopin.puzzles.pendingAttempts";
const tracker = { attempt: null, clock: null, summary: {}, lastId: null, watching: false };

const pending = () => JSON.parse(recall(PENDING_KEY, "[]"));

/** Sends the closed attempts not yet stored, oldest first; keeps those the server refused or missed. */
async function flush(closed) {
  const queue = [...pending(), closed];
  const left = [];
  for (const attempt of queue) {
    try {
      await savePuzzleAttempt(attempt);
    } catch {
      left.push(attempt);
    }
  }
  remember(PENDING_KEY, JSON.stringify(left));
}

/** What the server already holds, for the line under the title. */
export async function loadAttempts() {
  try {
    tracker.summary = (await fetchPuzzleAttempts()).summary;
  } catch {
    tracker.summary = {};
  }
}

/** Ends the attempt in progress — `won` true or false, or undefined when the puzzle is left — and sends it. */
export function endAttempt(won) {
  const { attempt, clock } = tracker;
  if (!attempt) return null;
  tracker.attempt = null;
  // A retry left before any move is not an attempt: the human only looked again.
  if (won === undefined && attempt.retry && attempt.moves.length === 0) return null;
  const closed = closeAttempt(attempt, won, clock.active());
  // The summary comes back from the server once the attempt is stored.
  flush(closed).then(loadAttempts);
  return closed;
}

/** A new attempt at `puzzle`; the one in progress, if any, is left. */
export function beginAttempt(puzzle) {
  endAttempt(undefined);
  // The clock stops while the page is out of focus: a note taken elsewhere is not thinking time.
  if (!tracker.watching) tracker.watching = Boolean(watchFocus(() => tracker.clock, () => {}));
  tracker.clock = createClock(() => performance.now());
  tracker.attempt = createAttempt(puzzle, new Date().toISOString(), tracker.lastId === puzzle.id);
  tracker.lastId = puzzle.id;
}

/** A human move, with the time since the previous one. */
export function attemptMove(move, winning, winners) {
  if (tracker.attempt) noteMove(tracker.attempt, { move, thinkMs: Math.round(tracker.clock.mark()), winning, winners });
}

export function attemptReveal() {
  if (tracker.attempt) noteReveal(tracker.attempt, Math.round(tracker.clock.active()));
}

/** « · ton meilleur : 42 s · 3 essais » for puzzle `id`, or nothing before a first attempt. */
export function attemptLine(id) {
  const entry = tracker.summary[id];
  if (!entry) return "";
  const best = entry.bestMs === null ? "pas encore résolu seul" : `ton meilleur : ${formatThinking(entry.bestMs)}`;
  const tries = `${entry.attempts} essai${entry.attempts > 1 ? "s" : ""}`;
  return ` · ${best} · ${tries}`;
}

/** « (en 42 s) » after a puzzle won, from its closed attempt; nothing after a loss. */
export const timeNote = (closed) => (closed && closed.result !== "lost" ? ` (en ${formatThinking(closed.activeMs)})` : "");
