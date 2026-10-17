import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { OFFICIAL_RULES } from "../../src/config/rules.js";
import { parseCard, parseCards } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { replayStates, finishLog, playLogged, rulesOf, startLog } from "../../src/replay/core/log.js";
import { BOTS } from "../../src/sim/bots.js";
import { isClaimable } from "../../src/sim/eval/certainty.js";
import { applyMove, canPlace, createGame, legalMoves, playGame } from "../../src/sim/engine/game.js";

const spec = DECKS.classique;
const rules = { order: ORDERS.original, jokerRule: JOKER_RULES.colorless };

function play(seed, endMode, players = ["strategist", "greedy"]) {
  const rng = createRng(seed);
  const bots = players.map((id) => BOTS[id](rng));
  return playGame(spec, { ...rules, rng, bots, endMode });
}

/** A whole `final` game, with every border that could have been claimed along the way. */
function claimableOverGame(seed) {
  const rng = createRng(seed);
  const bots = [BOTS.random(rng), BOTS.greedy(rng)];
  const state = createGame(spec, { ...rules, rng, endMode: "final" });
  const claims = [];
  while (!state.over) {
    state.borders.forEach((_, border) => {
      if (isClaimable(state, border, state.current)) claims.push({ player: state.current, border, turn: state.turn });
    });
    const moves = legalMoves(state);
    applyMove(state, moves.length ? bots[state.current].choose(state, moves) : null);
  }
  return { state, claims };
}

/** A `claim-end` game played move by move, `check(state, mover)` called after each move. */
function eachMove(seed, check) {
  const rng = createRng(seed);
  const bots = [BOTS.strategist(rng), BOTS.greedy(rng)];
  const state = createGame(spec, { ...rules, rng, endMode: "claim-end" });
  while (!state.over) {
    const mover = state.current;
    const moves = legalMoves(state);
    applyMove(state, moves.length ? bots[mover].choose(state, moves) : null);
    check(state, mover);
  }
  return state;
}

const fixture = JSON.parse(readFileSync(new URL("../fixtures/replays/claim-start-of-turn.json", import.meta.url), "utf8"));

/** The fixture's deck and moves, replayed under `endMode` up to move `last`. */
function replayUnder(endMode, last) {
  const { spec: logSpec, order, jokerRule } = rulesOf(fixture.rules);
  const state = createGame(logSpec, { order, jokerRule, endMode, deck: parseCards(logSpec, fixture.deck), rng: null });
  for (const entry of fixture.turns.slice(0, last)) {
    applyMove(state, entry.pass ? null : { card: parseCard(logSpec, entry.move.card), border: entry.move.border - 1 });
  }
  return state;
}

describe("endMode: claim-end", () => {
  it("is the page's rule", () => {
    assert.equal(OFFICIAL_RULES.endMode, "claim-end");
  });

  it("never claims a border the rest of the game would have lost, over 60 whole games", () => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const { state, claims } = claimableOverGame(seed);
      for (const { player, border, turn } of claims) {
        assert.equal(state.borders[border].owner, player, `game ${seed}, turn ${turn}, border ${border + 1}`);
        checked += 1;
      }
    }
    assert.ok(checked > 300, `only ${checked} claims were checked`);
  });

  it("leaves no provable border unclaimed after any move, over 20 games", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      eachMove(seed, (state) => {
        if (state.over) return;
        for (const player of [0, 1]) {
          state.borders.forEach((_, border) => assert.equal(isClaimable(state, border, player), false, `game ${seed}, move ${state.turn}, border ${border + 1}`));
        }
      });
    }
  });

  it("lets the mover claim before the opponent, within one move", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let seen = 0;
      eachMove(seed, (state, mover) => {
        const fresh = state.resolved.slice(seen).filter((entry) => entry.claimedAt === state.turn).map((entry) => entry.winner);
        seen = state.resolved.length;
        assert.deepEqual(fresh, [...fresh].sort((a, b) => Number(a !== mover) - Number(b !== mover)), `game ${seed}, move ${state.turn}`);
      });
    }
  });

  it("claims on the move that proves it — the 8♠ of the 30/09 replay, move 18", () => {
    assert.equal(fixture.turns[17].move.card, "8♠");
    assert.equal(replayUnder("claim-end", 18).borders[1].owner, 1, "border 2 is the bot's as soon as 8♠ lands");
    assert.equal(replayUnder("claim", 18).borders[1].owner, null, "the old rule waited for the next move");
  });

  it("settles borders during the game and stops at the first victory", () => {
    let early = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = play(seed, "claim-end");
      assert.ok(state.over);
      if (state.pile.length + state.hands[0].length + state.hands[1].length > 0) early += 1;
      const claimed = state.resolved.filter((entry) => entry.claimedAt !== undefined);
      assert.ok(claimed.length > 0, `game ${seed} claimed nothing`);
      for (const entry of claimed) assert.equal(state.borders[entry.border].owner, entry.winner);
    }
    assert.ok(early >= 10, `only ${early} games in 20 ended before the last card`);
  });

  it("closes a claimed border to both players", () => {
    const state = play(4, "claim-end");
    const claimed = state.resolved.find((entry) => entry.claimedAt !== undefined);
    for (const player of [0, 1]) for (const card of [1, 2, 3]) assert.equal(canPlace(state, player, card, claimed.border), false);
  });

  it("names the same winner as the final mode in most games, over 200", () => {
    let same = 0;
    for (let seed = 1; seed <= 200; seed += 1) if (play(seed, "claim-end").winner === play(seed, "final").winner) same += 1;
    // A claimed border takes no more cards, so the games themselves differ: this is a measure, not an identity.
    assert.ok(same >= 150, `${same} / 200`);
  });

  it("replays a logged game move for move, claims included", () => {
    const rng = createRng(21);
    const bots = [BOTS.strategist(rng), BOTS.greedy(rng)];
    const state = createGame(spec, { ...rules, rng, endMode: "claim-end" });
    const log = startLog(state, { rules: { deck: "classique", jokerRule: "colorless", order: "original", endMode: "claim-end" }, players: [], seed: 21 });
    while (!state.over) {
      const moves = legalMoves(state);
      playLogged(log, state, moves.length ? bots[state.current].choose(state, moves) : null);
    }
    finishLog(log, state);
    const last = replayStates(log).at(-1).state;
    assert.deepEqual(last.resolved, state.resolved);
    assert.equal(last.winner, state.winner);
  });
});

describe("endMode: claim, the rule of 30/09", () => {
  it("still replays its games as they were played", () => {
    const last = replayStates(fixture).at(-1).state;
    assert.equal(last.winner, fixture.result.winner);
    assert.equal(last.resolved.find((entry) => entry.border === 1).claimedAt, 19);
  });
});
