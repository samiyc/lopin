import { BOT_LINEUP, botTag, engineOf } from "../../../src/config/bots.js";
import { OFFICIAL_RULES } from "../../../src/config/rules.js";
import { createRng } from "../../../src/core/random.js";
import { playLogged, rulesOf } from "../../../src/replay/core/log.js";
import { engineFor, pickBest } from "../../../src/sim/bots.js";
import { createGame, legalMoves } from "../../../src/sim/engine/game.js";
import { figuresFor } from "../board/figure-input.js";

/**
 * Games as the page plays them: the official rules, borders settled at the
 * end, every move logged. The same functions drive a human game and generate
 * an observer game, so both read the same way in the replay viewer.
 */
export const RULES = OFFICIAL_RULES;
export const SPEC = rulesOf(RULES).spec;

/** A new game; `bonus` figures of the extension (0 to 6) join its pile, openHands reveals hands. */
export function newGame(seed, bonus = 0, openHands = false) {
  const { spec, order, jokerRule, endMode } = rulesOf(RULES);
  return createGame(spec, { order, jokerRule, endMode, rng: createRng(seed), figures: figuresFor(seed, bonus), openHands: Boolean(openHands), seed });
}

/** A bot playing `engine` (any engine id: the Labo builds some off the line-up), seeded as the line-up's. */
export const enginePlayer = (engine, seed, id = engine) => ({ id, engine, bot: engineFor(engine)(createRng(seed)), rng: createRng(seed ^ 0x5bd1e995) });

export const botPlayer = (id, seed) => enginePlayer(engineOf(id), seed, id);

export const botEntry = (seat, id) => ({ seat, kind: "bot", bot: id, version: BOT_LINEUP[id].version, label: BOT_LINEUP[id].label });

/** A bot off the line-up (the Labo, lot 2), logged as the duels log theirs (`bot` and `version` its engine id) with its `engine` and a name. */
export const engineEntry = (seat, engine, label) => ({ seat, kind: "bot", bot: engine, version: engine, engine, label });

export const humanEntry = (seat, name) => ({ seat, kind: "human", name });

/** What the bot would play in `state` (null: it must pass), with its scored candidates. */
export function botChoice(state, player) {
  const moves = legalMoves(state);
  if (moves.length === 0) return { move: null, scored: null };
  const scored = player.bot.scoreMoves(state, moves);
  return { move: pickBest(scored, player.rng), scored };
}

/** Plays the bot's turn in `state`, logged with its best candidates. */
export function playBot(log, state, player) {
  const { move, scored } = botChoice(state, player);
  return playLogged(log, state, move, scored);
}

/** "Stratège 1.1.0", the human's name, or a Labo bot's name, for a log's player entry. */
export function playerName(entry) {
  if (!entry) return "";
  if (entry.kind === "human") return entry.name;
  return entry.engine ? entry.label : `${entry.label ?? entry.bot} ${entry.version}`;
}

export { botTag };
