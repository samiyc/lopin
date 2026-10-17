import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { OFFICIAL_RULES as PAGE_RULES } from "../../src/config/rules.js";

// Written against a full game: every card played, borders settled at the end.
const OFFICIAL_RULES = { ...PAGE_RULES, endMode: "final" };
import { JOKER, cardOf } from "../../src/core/cards.js";
import { createRng } from "../../src/core/random.js";
import { finishLog, playLogged, replayStates, rulesOf, snapshot, startLog } from "../../src/replay/core/log.js";
import { BOTS } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { followHands, moveCard, sortBySuit, sortByValue, syncOrder } from "../../web/app/board/hand.js";
import { START, endOf, isAtEnd, stepBack, stepForward } from "../../web/app/replays/steps.js";
import { cardView, replayLabel, suitCounts, suitOrder, tableView } from "../../web/app/replays/view.js";

const spec = DECKS.classique;
const at = (value, suit) => cardOf(spec, suit, value);

describe("the hand order", () => {
  it("keeps the player's order through plays and draws, jokers included", () => {
    const order = [at(9, 0), JOKER, at(2, 1), JOKER];
    const hand = [JOKER, at(2, 1), at(7, 3), JOKER];
    assert.deepEqual(syncOrder(order, hand), [JOKER, at(2, 1), JOKER, at(7, 3)]);
  });

  it("moves a card to a new place", () => {
    assert.deepEqual(moveCard([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
    assert.deepEqual(moveCard([1, 2, 3, 4], 3, 0), [4, 1, 2, 3]);
    assert.deepEqual(moveCard([1, 2, 3], 5, 0), [1, 2, 3]);
  });

  it("follows a logged hand: sorted at the deal, new cards on the right, re-sorted where asked", () => {
    const hands = [
      [at(9, 1), at(2, 0), JOKER],
      [at(9, 1), JOKER, at(5, 3)],
      [at(9, 1), at(5, 3), at(1, 2)],
      [at(9, 1), at(1, 2), at(4, 0)],
    ];
    assert.deepEqual(followHands(spec, hands), [
      [at(2, 0), at(9, 1), JOKER],
      [at(9, 1), JOKER, at(5, 3)],
      [at(9, 1), at(5, 3), at(1, 2)],
      [at(9, 1), at(1, 2), at(4, 0)],
    ]);
    const sorted = followHands(spec, hands, new Map([[2, sortByValue]]));
    assert.deepEqual(sorted[2], [at(1, 2), at(5, 3), at(9, 1)]);
    assert.deepEqual(sorted[3], [at(1, 2), at(9, 1), at(4, 0)]);
  });

  it("sorts by suit or by value, jokers last", () => {
    const hand = [JOKER, at(5, 2), at(3, 0), at(5, 0)];
    assert.deepEqual(sortBySuit(spec, hand), [at(3, 0), at(5, 0), at(5, 2), JOKER]);
    // Suits alternate black and red: ♠ ♥ ♣ ♦.
    const suits = [at(2, 2), at(9, 3), at(4, 1), at(8, 0)];
    assert.deepEqual(sortBySuit(spec, suits), [at(8, 0), at(4, 1), at(9, 3), at(2, 2)]);
    assert.deepEqual(sortByValue(spec, hand), [at(3, 0), at(5, 0), at(5, 2), JOKER]);
    assert.deepEqual(sortByValue(spec, [at(5, 2), at(3, 3)]), [at(3, 3), at(5, 2)]);
  });
});

describe("the suit bar", () => {
  it("alternates black and red", () => {
    assert.deepEqual(suitOrder(spec).map((color) => spec.suits[color]), ["♠", "♥", "♣", "♦"]);
    assert.deepEqual(suitOrder(DECKS.tarot).map((color) => DECKS.tarot.suits[color]), ["♠", "♥", "♣", "♦", "★"]);
  });

  it("counts what the bottom player can see, and the other hand only when revealed", () => {
    const snap = {
      borders: [{ sides: [[at(1, 1), at(2, 1)], [at(9, 1), JOKER]] }, { sides: [[], [at(3, 0)]] }],
      hands: [[at(5, 1), at(6, 3)], [at(7, 1), at(8, 2)]],
    };
    const count = (counts, suit) => counts.find((line) => line.suit === suit).seen;
    const mine = suitCounts(spec, snap, { bottom: 0, reveal: false });
    assert.equal(count(mine, "♥"), 4);
    assert.equal(count(mine, "♦"), 0);
    assert.equal(count(mine, "♠"), 1);
    assert.equal(mine[0].total, 10);
    assert.equal(count(suitCounts(spec, snap, { bottom: 0, reveal: true }), "♥"), 5);
    assert.equal(count(suitCounts(spec, snap, { bottom: 1, reveal: false }), "♦"), 1);
    const joker = mine.at(-1);
    assert.deepEqual([joker.label, joker.seen, joker.total], ["JK", 1, 2], "the joker on the board, out of the deck's two");
  });
});

describe("the table view", () => {
  const { order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
  const rng = createRng(4);
  const state = createGame(spec, { order, jokerRule, endMode, rng });

  it("draws cards with their value, suit and ink", () => {
    assert.deepEqual(cardView(spec, at(7, 1)), { id: at(7, 1), text: "7♥", value: "7", suit: "♥", red: true, joker: false });
    assert.equal(cardView(spec, JOKER).joker, true);
  });

  it("hides the opponent's hand when playing, shows it when observing", () => {
    const playing = tableView(spec, snapshot(state), { bottom: 0 });
    assert.equal(playing.top.hidden, true);
    assert.deepEqual(playing.top.cards, []);
    assert.equal(playing.top.count, 6);
    const observing = tableView(spec, snapshot(state), { bottom: 0, reveal: true });
    assert.equal(observing.top.cards.length, 6);
  });

  it("shows the opponent's hand when playing with openHands", () => {
    const openState = createGame(spec, { order, jokerRule, endMode, rng, openHands: true });
    const view = tableView(spec, snapshot(openState), { bottom: 0 });
    assert.equal(view.top.hidden, false);
    assert.equal(view.top.cards.length, 6);
  });

  it("gives the turn number and the pile, and whose turn it is", () => {
    const view = tableView(spec, snapshot(state), { bottom: 1 });
    assert.equal(view.turn, 1);
    assert.equal(view.pile, 30);
    assert.equal(view.current, "top");
  });

  it("keeps stones grey during the game, then green or red from the bottom's side", () => {
    const bots = [BOTS.greedy(rng), BOTS.strategist(rng)];
    while (!state.over) applyMove(state, bots[state.current].choose(state, legalMoves(state)));
    const snap = snapshot(state);
    const before = tableView(spec, snap, { bottom: 0, shown: 0 });
    assert.ok(before.borders.every((border) => border.stone.state === "neutral"));
    assert.equal(before.result, null);
    const after = tableView(spec, snap, { bottom: 0 });
    for (const border of after.borders) {
      const owner = snap.borders[border.index].owner;
      assert.equal(border.stone.state, owner === 0 ? "won" : "lost");
      assert.equal(border.stone.toward, owner === 0 ? "bottom" : "top");
      assert.ok(border.formations.top && border.formations.bottom);
    }
    assert.equal(after.result.outcome, snap.winner === 0 ? "bottom" : "top");
  });
});

describe("the replay player's steps", () => {
  const LAST = 42;
  const SETTLED = 7;

  it("walks forward move by move, then settles the borders one by one", () => {
    assert.deepEqual(stepForward(START, LAST, SETTLED), { index: 1, shown: 0 });
    assert.deepEqual(stepForward({ index: 41, shown: 0 }, LAST, SETTLED), { index: 42, shown: 0 });
    assert.deepEqual(stepForward({ index: 42, shown: 3 }, LAST, SETTLED), { index: 42, shown: 4 });
    assert.deepEqual(stepForward(endOf(LAST, SETTLED), LAST, SETTLED), endOf(LAST, SETTLED));
    assert.ok(isAtEnd(endOf(LAST, SETTLED), LAST, SETTLED));
  });

  it("steps back one move, even from the settled end", () => {
    assert.deepEqual(stepBack(endOf(LAST, SETTLED)), { index: 41, shown: 0 });
    assert.deepEqual(stepBack({ index: 42, shown: 0 }), { index: 41, shown: 0 });
    assert.deepEqual(stepBack(START), START);
  });

  it("shows the pile each logged turn saw, down to an empty pile for the last twelve", () => {
    const { spec: logSpec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
    const rng = createRng(11);
    const game = createGame(logSpec, { order, jokerRule, endMode, rng });
    const players = [
      { seat: 0, kind: "bot", bot: "stratege", version: "test" },
      { seat: 1, kind: "bot", bot: "basique", version: "test" },
    ];
    const log = startLog(game, { rules: OFFICIAL_RULES, players, seed: 11, startedAt: "2026-09-24T10:00:00+02:00" });
    const bots = [BOTS.strategist(rng), BOTS.greedy(rng)];
    while (!game.over) playLogged(log, game, bots[game.current].choose(game, legalMoves(game)));
    const frames = replayStates(finishLog(log, game, "2026-09-24T10:05:00+02:00"));
    log.turns.forEach((entry, i) => assert.equal(tableView(spec, frames[i].state, { bottom: 0 }).pile, entry.pile, `turn ${i + 1}`));
    assert.equal(frames.filter((frame) => frame.state.pile === 0).length, 13, "the last twelve moves, and the end");
  });
});

describe("the replay list", () => {
  const nameOf = (player) => (player.kind === "human" ? player.name : `Stratège ${player.version}`);
  const header = (overrides) => ({
    startedAt: "2026-09-24T01:57:33+02:00",
    players: [
      { seat: 1, kind: "bot", bot: "stratege", version: "1.1.0" },
      { seat: 0, kind: "human", name: "Sami" },
    ],
    winner: 0,
    winType: "majority",
    borders: [4, 3],
    durationMs: 21 * 60000,
    ...overrides,
  });

  it("puts (W) on the winner's side, first player first", () => {
    assert.deepEqual(replayLabel(header(), nameOf), {
      title: "(W) Sami -vs- Stratège 1.1.0",
      detail: "Score:4-3. Standard",
      sub: "Durée:21min. 24/09/26 à 01h57",
      outcome: "won",
    });
    const lost = replayLabel(header({ winner: 1, winType: "adjacent", borders: [3, 4], bonus: 6 }), nameOf);
    assert.equal(lost.title, "Sami -vs- Stratège 1.1.0 (W)");
    assert.equal(lost.detail, "3 bornes connectées. Extension (6 bonus)");
    assert.equal(lost.sub, "Durée:21min. 24/09/26 à 01h57");
    assert.equal(lost.outcome, "lost");
    assert.equal(replayLabel(header({ client: "cli" }), nameOf).detail, "Score:4-3. Standard · CLI", "a game played in the terminal (Sami, 14/10)");
    assert.equal(replayLabel(header({ client: "cli", bonus: 6 }), nameOf).detail, "Score:4-3. Extension (6 bonus) · CLI");
  });

  it("leaves bot games uncoloured, and skips what an old log lacks", () => {
    const bots = header({ players: [{ seat: 0, kind: "bot", version: "1.1.0" }, { seat: 1, kind: "bot", version: "1.0.0" }], durationMs: null });
    const label = replayLabel(bots, nameOf);
    assert.equal(label.outcome, null);
    assert.equal(label.detail, "Score:4-3. Standard");
    assert.equal(label.sub, "24/09/26 à 01h57");
  });
});
