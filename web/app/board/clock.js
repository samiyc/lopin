/**
 * The game clock: how long a game has really been played, and how long each
 * of the human's moves took. It stops while the page is out of sight or out
 * of focus — a note taken in another window is not thinking time — so the
 * slow moves in the logs are the hard ones, not the interrupted ones.
 *
 * `createClock(now)` is pure (`now` injected, like the engine's rng) and
 * tested under Node; `watchFocus` wires it to the window.
 */
export function createClock(now) {
  let running = true;
  let since = now();
  let banked = 0;
  let mark = 0;
  const active = () => banked + (running ? now() - since : 0);
  return {
    /** Active milliseconds since the clock started. */
    active,
    /** Active milliseconds since the last `mark()`. */
    sinceMark: () => active() - mark,
    /** Starts timing a move; returns the time since the previous mark. */
    mark() {
      const elapsed = active() - mark;
      mark = active();
      return elapsed;
    },
    pause() {
      if (!running) return;
      banked += now() - since;
      running = false;
    },
    resume() {
      if (running) return;
      since = now();
      running = true;
    },
    isRunning: () => running,
  };
}

/** "Ce coup 0:12 · Partie 4:05 · en pause": the line under the turn number. */
export function clockLine(clock, { humanTurn, over }) {
  const move = humanTurn ? `Ce coup ${formatDuration(clock.sinceMark())} · ` : "";
  const paused = !over && !clock.isRunning() ? " · en pause" : "";
  return `${move}Partie ${formatDuration(clock.active())}${paused}`;
}

/** "0:07", "12:45": minutes and seconds. */
export function formatDuration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "45 s", "2 min 30 s": how long a move took. */
export function formatThinking(ms) {
  const seconds = Math.round(Math.max(0, ms) / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

/** "21 min": how long a game took, never less than a minute. */
export const formatMinutes = (ms) => `${Math.max(1, Math.round(ms / 60000))} min`;

/**
 * Pauses `current()` (the clock of the game in progress, or null) whenever
 * the page loses focus or is hidden, and resumes it on return. `onChange`
 * redraws the display.
 */
export function watchFocus(current, onChange) {
  const sync = () => {
    const clock = current();
    if (!clock) return;
    if (document.visibilityState === "visible" && document.hasFocus()) clock.resume();
    else clock.pause();
    onChange();
  };
  window.addEventListener("blur", sync);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", sync);
  return sync;
}
