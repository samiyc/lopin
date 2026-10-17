import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { JOKER, buildDeck, cardOf } from "../../src/core/cards.js";
import { createRng } from "../../src/core/random.js";
import { greedyBot, randomBot } from "../../src/sim/bots.js";
import { applyMove, canPlace, createGame, legalMoves, playGame } from "../../src/sim/engine/game.js";
import { playBatch, simulate } from "../../src/sim/engine/simulate.js";

const { free, onePerBorder, onePerPlayer } = JOKER_RULES;
const classique = DECKS.classique;

const newGame = (jokerRule = free, seed = 1) =>
  createGame(classique, { order: ORDERS.original, jokerRule, rng: createRng(seed) });

const allCards = (state) => [
  ...state.pile,
  ...state.hands.flat(),
  ...state.borders.flatMap((border) => border.sides.flat()),
];

describe("createGame", () => {
  it("deals two hands of six and keeps the rest as the pile", () => {
    const state = newGame();
    assert.equal(state.hands[0].length, 6);
    assert.equal(state.hands[1].length, 6);
    assert.equal(state.pile.length, 42 - 12);
    assert.equal(state.borders.length, 7);
  });
});

describe("joker rules", () => {
  it("one joker per border refuses a second joker on the same side", () => {
    const state = newGame(onePerBorder);
    state.borders[0].sides[0].push(JOKER);
    assert.equal(canPlace(state, 0, JOKER, 0), false);
    assert.equal(canPlace(state, 0, JOKER, 1), true);
  });

  it("one joker per player refuses a second joker anywhere", () => {
    const state = newGame(onePerPlayer);
    state.jokersPlayed[0] = 1;
    assert.equal(canPlace(state, 0, JOKER, 3), false);
    assert.equal(canPlace(state, 1, JOKER, 3), true);
  });

  it("free jokers may share a side", () => {
    const state = newGame(free);
    state.borders[0].sides[0].push(JOKER);
    assert.equal(canPlace(state, 0, JOKER, 0), true);
  });
});

describe("resolving a border", () => {
  const at = (color, value) => cardOf(classique, color, value);

  it("goes to the better formation once both sides hold three cards", () => {
    const state = newGame();
    state.borders[2].sides[1] = [at(0, 2), at(1, 7), at(2, 9)];
    state.borders[2].sides[0] = [at(3, 4), at(3, 5)];
    state.hands[0] = [at(3, 6), ...state.hands[0].slice(1)];
    applyMove(state, { card: at(3, 6), border: 2 });
    assert.equal(state.borders[2].owner, 0);
    assert.deepEqual(state.resolved[0].formations, ["straightFlush", "sum"]);
    assert.equal(state.resolved[0].decidedBy, "formation");
  });

  it("breaks a full tie in favour of whoever finished first", () => {
    const state = newGame();
    const border = state.borders[4];
    border.sides[1] = [at(0, 2), at(1, 5), at(2, 9)];
    border.completedAt[1] = -1;
    border.sides[0] = [at(1, 2), at(2, 5)];
    state.hands[0] = [at(3, 9), ...state.hands[0].slice(1)];
    applyMove(state, { card: at(3, 9), border: 4 });
    assert.equal(border.owner, 1);
    assert.equal(state.resolved[0].decidedBy, "first");
  });
});

describe("playGame", () => {
  const bots = (rng) => [randomBot(rng), randomBot(rng)];

  for (const [name, rule] of Object.entries({ free, onePerBorder, onePerPlayer })) {
    it(`never loses or duplicates a card, and ends (${name})`, () => {
      for (let seed = 1; seed <= 30; seed += 1) {
        const rng = createRng(seed);
        const state = playGame(classique, { order: ORDERS.original, jokerRule: rule, rng, bots: bots(rng) });
        assert.ok(state.over, `seed ${seed} did not end`);
        assert.deepEqual(allCards(state).sort((a, b) => a - b), buildDeck(classique).sort((a, b) => a - b));
        for (const border of state.borders) {
          for (const side of border.sides) assert.ok(side.length <= 3);
        }
      }
    });
  }

  it("a winner holds three adjacent borders or a majority", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const rng = createRng(seed);
      const state = playGame(classique, { order: ORDERS.original, jokerRule: free, rng, bots: bots(rng) });
      const owned = state.borders.map((border) => border.owner === state.winner);
      const count = owned.filter(Boolean).length;
      const adjacent = owned.some((_, i) => owned.slice(i, i + 3).length === 3 && owned.slice(i, i + 3).every(Boolean));
      assert.ok(count >= 4 || adjacent, `seed ${seed}`);
    }
  });

  it("offers every distinct card on every open side as a move", () => {
    const state = newGame();
    const distinct = new Set(state.hands[0]).size;
    assert.equal(legalMoves(state).length, distinct * 7);
  });
});

describe("simulate", () => {
  const options = (players) => ({
    order: ORDERS.original, jokerRule: free, games: 40, seed: 5, players,
  });

  it("is reproducible from its seed", () => {
    const a = playBatch(classique, options(["greedy", "greedy"]));
    const b = playBatch(classique, options(["greedy", "greedy"]));
    assert.deepEqual(a, b);
  });

  it("the greedy player beats the random one, from either seat", () => {
    const first = simulate(classique, options(["greedy", "random"]));
    const second = simulate(classique, options(["random", "greedy"]));
    assert.ok(first.shares.firstPlayerWins > 0.8);
    assert.ok(second.shares.secondPlayerWins > 0.8);
  });

  it("counts every finished side and every resolved border", () => {
    const result = simulate(classique, options(["random", "random"]));
    const built = Object.values(result.built).reduce((a, b) => a + b, 0);
    const decided = Object.values(result.decidedBy).reduce((a, b) => a + b, 0);
    assert.equal(built, result.builtTotal);
    assert.equal(Object.values(result.winning).reduce((a, b) => a + b, 0), decided);
    assert.equal(result.wins[0] + result.wins[1] + result.draws, result.games);
  });

  it("bots are plain factories over one shared generator", () => {
    const rng = createRng(3);
    assert.equal(greedyBot(rng).name, "greedy");
    assert.equal(randomBot(rng).name, "random");
  });
});
