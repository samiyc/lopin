/**
 * Where a log on show lives on disk, for the Labo's « Copier les commandes »: a Labo game once saved
 * (`replays/…`), a replay opened from the list (`replays/…` or `data/replays/…`). Nothing for a game never saved.
 */
const paths = new WeakMap();

export const rememberPath = (log, path) => paths.set(log, path);

export const pathOf = (log) => paths.get(log) ?? null;

/** The server's replay folders (REPLAY_DIRS, scripts/lib/domain/replay-files.js), by the list's `dir`. */
const DIRS = { recent: "replays", kept: "data/replays" };

export const listedPath = (dir, name) => `${DIRS[dir] ?? dir}/${name}`;
