import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buttonsFor, countIn, favoritesOnly, hintOf, isDoubleTurn, isFork, isImmediate, kindLabel, namesOf, openingMessage, puzzleStatus, statusLine, toggleFavorite, unsolvedOnly } from "../web/app/puzzle-kinds.js";

describe("the double-threat puzzles (kind fork)", () => {
  it("play out like an endgame, with their own words", () => {
    const fork = { kind: "fork", solutions: ["7♥→2"], moves: 9 };
    assert.ok(isFork(fork));
    assert.equal(isImmediate(fork), false, "the page plays it against the solver");
    assert.match(openingMessage(fork), /Double menace/);
    assert.match(hintOf(fork), /Puissance 4/);
    assert.equal(namesOf(fork).top, "Adversaire — jeu parfait");
    assert.match(openingMessage({ solutions: ["7♥→2"], moves: 9 }), /^Trouve le coup gagnant/);
    assert.equal(kindLabel({ ...fork, turn: 33 }), "double menace, tour 33");
    assert.equal(kindLabel({ turn: 33 }), "tour 33");
    assert.equal(kindLabel({ kind: "immediate", cardsLeft: 12 }), "gain immédiat, pioche 12");
  });
});

describe("the double-turn puzzles (kind pass)", () => {
  it("play out like an endgame, with their own words", () => {
    const pass = { kind: "pass", solutions: ["9♠→1"], moves: 15, turn: 33 };
    assert.ok(isDoubleTurn(pass) && !isFork(pass) && !isImmediate(pass));
    assert.match(openingMessage(pass), /^Double tour/);
    assert.match(hintOf(pass), /adversaire/);
    assert.equal(kindLabel(pass), "double tour, tour 33");
  });

  it("are found by the move that leaves the opponent no move: puzzle #313's 9♠→1", async () => {
    const { readFile } = await import("node:fs/promises");
    const { stateAt } = await import("../src/replay/log.js");
    const { legalMoves } = await import("../src/sim/game.js");
    const { formatCard } = await import("../src/core/notation.js");
    const { forcesPass } = await import("../src/sim/double-turn.js");
    const puzzles = JSON.parse(await readFile(new URL("../web/data/puzzles.json", import.meta.url), "utf8")).puzzles;
    const puzzle = puzzles.find((p) => p.id === 313);
    const state = stateAt(puzzle.log, puzzle.turn);
    const text = (move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;
    const passing = legalMoves(state).filter((move) => forcesPass(state, move)).map(text);
    assert.ok(passing.includes("9♠→1"));
    assert.ok(!passing.includes(puzzle.coreMove), "the core's move lets the opponent play");
  });
});

describe("where a puzzle stands", () => {
  it("is playing until it is over, then solved, helped or lost", () => {
    assert.equal(puzzleStatus(null), "playing");
    assert.equal(puzzleStatus({ won: true, helped: false }), "solved");
    assert.equal(puzzleStatus({ won: true, helped: true }), "helped");
    assert.equal(puzzleStatus({ won: false, helped: false }), "lost");
  });

  it("turns the next button green once won, reveal and retry once lost", () => {
    assert.deepEqual(buttonsFor("playing"), { next: false, reveal: false, retry: false });
    assert.deepEqual(buttonsFor("solved"), { next: true, reveal: false, retry: false });
    assert.deepEqual(buttonsFor("lost"), { next: false, reveal: true, retry: true });
    assert.equal(statusLine("playing"), null);
    assert.equal(statusLine("solved").tone, "won");
    assert.equal(statusLine("lost").tone, "lost");
  });

  it("keeps favourites by id, and can draw from them alone", () => {
    assert.deepEqual(toggleFavorite([3, 7], 5), [3, 7, 5]);
    assert.deepEqual(toggleFavorite([3, 7], 7), [3]);
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }];
    assert.deepEqual(favoritesOnly([2, 0, 1], list, new Set([3, 1])), [2, 0]);
    assert.deepEqual(favoritesOnly([2, 0, 1], list, new Set()), [2, 0, 1], "no favourite: the whole order");
  });

  it("keeps the unsolved puzzles, or the whole order once all are solved", () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }];
    assert.deepEqual(unsolvedOnly([2, 0, 1], list, new Set([3])), [0, 1]);
    assert.deepEqual(unsolvedOnly([2, 0, 1], list, new Set([1, 2, 3])), [2, 0, 1], "all solved: the whole order");
  });
});

describe("the puzzle counters", () => {
  it("count only the ids of puzzles still in the file", () => {
    const list = [{ id: 2 }, { id: 3 }, { id: 291 }];
    assert.equal(countIn(list, new Set([1, 2, 3, 7, 13])), 2, "1, 7 and 13 left the file");
    assert.equal(countIn(list, new Set()), 0);
  });
});
