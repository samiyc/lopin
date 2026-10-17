/**
 * Where replay files live and how they are named — the server's only say in
 * the file system, so it is kept pure and tested.
 *
 * - `recent`: every game against a bot, saved automatically (`replays/`,
 *   ignored by git);
 * - `kept`: the ones worth keeping for analysis (`data/replays/`, versioned).
 */
export const REPLAY_DIRS = Object.freeze({ recent: "replays", kept: "data/replays" });

const SAFE_NAME = /^[\w-]+(\.[\w-]+)*\.json$/;

/** A bare file name ending in .json: no folder, no "..", nothing to escape with. */
export const isSafeName = (name) => typeof name === "string" && SAFE_NAME.test(name) && !name.includes("..");

export const isReplayDir = (dir) => Object.hasOwn(REPLAY_DIRS, dir);

const slug = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function playerSlug(player) {
  return slug(player.kind === "human" ? player.name ?? "humain" : player.bot);
}

/**
 * "4-3": borders won by each seat, first player first. The winner's number
 * becomes "B" when the game was won by three adjacent borders ("B-2"). Empty
 * for a log without a result.
 */
export function scoreTag(result) {
  if (!result?.borders) return "";
  const won = [0, 1].map((seat) => result.borders.filter((border) => border.winner === seat).length);
  return won.map((count, seat) => (result.winType === "adjacent" && result.winner === seat ? "B" : String(count))).join("-");
}

/** "2026-09-24_10-15-30_humain-vs-stratege_4-3.json", from the log's own data. */
export function replayFileName(log) {
  const stamp = log.startedAt.slice(0, 19).replace("T", "_").replaceAll(":", "-");
  const seats = [...log.players].sort((a, b) => a.seat - b.seat).map(playerSlug).join("-vs-");
  const score = scoreTag(log.result);
  const suffix = score ? "_" + score : "";
  return `${stamp}_${seats}${suffix}.json`;
}

/** Borders won by each seat, or null without a result. */
const bordersWon = (result) => (result?.borders ? [0, 1].map((seat) => result.borders.filter((border) => border.winner === seat).length) : null);

/** Time played: the clock's `activeMs`, or the wall clock for older logs. */
function durationOf(log) {
  if (typeof log.result?.activeMs === "number") return log.result.activeMs;
  const span = Date.parse(log.endedAt) - Date.parse(log.startedAt);
  return Number.isFinite(span) ? span : null;
}

const FIGURE_TEXTS = new Set(["V♣", "V♦", "D♥", "D♠", "R♠", "R♦"]);

const bonusCount = (log) => {
  if (typeof log.rules?.bonus === "number") return log.rules.bonus;
  if (Array.isArray(log.deck)) {
    const count = log.deck.filter((card) => FIGURE_TEXTS.has(card)).length;
    if (count > 0) return count;
  }
  return 0;
};

/** What the replay list shows, without sending whole logs. */
export function replayHeader(dir, name, log) {
  return {
    dir,
    name,
    startedAt: log.startedAt,
    players: log.players,
    turns: log.turns.length,
    winner: log.result?.winner ?? null,
    winType: log.result?.winType ?? null,
    borders: bordersWon(log.result),
    durationMs: durationOf(log),
    bonus: bonusCount(log),
    // Where the game was played (Sami, 14/10): "cli" for npm run cli, null for the page, which writes no client.
    client: log.client?.app ?? null,
  };
}
