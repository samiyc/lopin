import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OFFICIAL_RULES as PAGE_RULES } from "../../src/config/rules.js";

// Written against a full game: every card played, borders settled at the end.
const OFFICIAL_RULES = { ...PAGE_RULES, endMode: "final" };
import { createRng } from "../../src/core/random.js";
import { isJoker } from "../../src/core/cards.js";
import { finishLog, playLogged, replayStates, rulesOf, startLog } from "../../src/replay/core/log.js";
import { summarizeReplays } from "../../src/replay/stats/summary.js";
import { BOTS, pickBest } from "../../src/sim/bots.js";
import { createGame, legalMoves } from "../../src/sim/engine/game.js";

/** A logged game where seat 0 is marked human but plays like the strategist. */
function humanLikeGame(seed) {
  const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
  const rng = createRng(seed);
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  const players = [
    { seat: 0, kind: "human", name: "Test" },
    { seat: 1, kind: "bot", bot: "basique", version: "1.0.0" },
  ];
  const bots = [BOTS.strategist(rng), BOTS.greedy(rng)];
  const log = startLog(state, { rules: OFFICIAL_RULES, players, seed, startedAt: "2026-09-24T10:00:00+02:00" });
  while (!state.over) {
    const moves = legalMoves(state);
    const scored = bots[state.current].scoreMoves(state, moves);
    const move = pickBest(scored, rng);
    playLogged(log, state, move, state.current === 1 ? scored : null);
  }
  return finishLog(log, state, "2026-09-24T10:05:00+02:00");
}

describe("summarizeReplays", () => {
  const logs = [humanLikeGame(1), humanLikeGame(2)];
  const summary = summarizeReplays(logs, { advisor: BOTS.strategist(createRng(1)) });

  it("counts the human's results against each bot version", () => {
    const line = summary.vsBots["basique@1.0"];
    assert.equal(line.games, 2);
    assert.equal(line.won + line.lost + line.drawn, 2);
  });

  it("counts every settled line once, by side", () => {
    const total = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
    assert.equal(total(summary.formations.human), 14);
    assert.equal(total(summary.formations.bot), 14);
  });

  it("agrees with a human who plays exactly like the advisor", () => {
    assert.equal(summary.advice.moves, 42);
    assert.equal(summary.advice.agreed, 42);
    assert.deepEqual(summary.advice.examples, []);
  });

  it("skips unfinished logs", () => {
    const unfinished = { ...logs[0], result: null };
    assert.equal(summarizeReplays([unfinished]).advice.moves, 0);
  });
});

/** A game where seat 0, marked human, drops its first joker on an empty border. */
function stubbornJokerGame(seed) {
  const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
  const rng = createRng(seed);
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  const players = [
    { seat: 0, kind: "human", name: "Test" },
    { seat: 1, kind: "bot", bot: "basique", version: "1.0.0" },
  ];
  const bots = [BOTS.greedy(rng), BOTS.greedy(rng)];
  const log = startLog(state, { rules: OFFICIAL_RULES, players, seed, startedAt: "2026-09-24T10:00:00+02:00" });
  let stubborn = true;
  while (!state.over) {
    const moves = legalMoves(state);
    const odd = moves.find((move) => isJoker(move.card) && state.borders[move.border].sides[0].length === 0);
    const hasOther = moves.some((move) => !isJoker(move.card));
    const forced = state.current === 0 && stubborn && odd && hasOther;
    if (forced) stubborn = false;
    playLogged(log, state, forced ? odd : pickBest(bots[state.current].scoreMoves(state, moves), rng));
  }
  return { log: finishLog(log, state, "2026-09-24T10:05:00+02:00"), forcedJoker: !stubborn };
}

describe("advice on a joker the strategist refuses", () => {
  const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((candidate) => stubbornJokerGame(candidate).forcedJoker);
  const { log } = stubbornJokerGame(seed);

  it("marks the move refused instead of crashing", () => {
    const frames = replayStates(log, { advisor: BOTS.strategist(createRng(1)) });
    const refused = frames.filter((frame) => frame.refused);
    assert.equal(refused.length, 1);
    assert.equal(refused[0].adviceGap, null);
    assert.ok(refused[0].advice.length > 0, "the advisor still says what it would play");
  });

  it("lists it apart in the summary", () => {
    const summary = summarizeReplays([log], { advisor: BOTS.strategist(createRng(1)) });
    assert.equal(summary.advice.refused.length, 1);
    assert.equal(summary.advice.refused[0].played.card, "JK");
  });
});

describe("thinking times", () => {
  const { log } = stubbornJokerGame(3);
  const timed = structuredClone(log);
  timed.turns.forEach((entry, i) => {
    if (entry.player === 0) entry.thinkMs = 1000 * (i % 7);
  });

  it("do not bother the replay", () => {
    assert.equal(replayStates(timed).length, timed.turns.length + 1);
  });

  it("list the human's slowest moves first", () => {
    const { thinking } = summarizeReplays([timed]);
    assert.equal(thinking.moves, 21);
    assert.equal(thinking.slowest[0].thinkMs, 6000);
    assert.ok(thinking.slowest.every((move, i, all) => i === 0 || all[i - 1].thinkMs >= move.thinkMs));
    assert.equal(summarizeReplays([log]).thinking.moves, 0);
  });
});
