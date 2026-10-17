import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { FIGURE_IDS, figureByKey, isFigure } from "../../src/core/figures.js";
import { parseCards } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { replayStates, startLog, playLogged, finishLog } from "../../src/replay/core/log.js";
import { BOTS } from "../../src/sim/bots.js";
import { evaluatorFor } from "../../src/sim/engine/border-rules.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { resolveBorder } from "../../src/sim/engine/settle.js";

const spec = DECKS.classique;
const cards = (...texts) => parseCards(spec, texts);
const id = (key) => figureByKey(key).id;

/** A claim-end game with the six figures in its deck. */
const newGame = (seed = 1, figures = FIGURE_IDS) => createGame(spec, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed), endMode: "claim-end", figures, seed });

/** Border 0 with the given sides and figures; who wins it under its rules (1 when player 1's side scores higher). */
function winnerOf(game, sides, figures) {
  Object.assign(game.borders[0], { sides, figures, completedAt: [1, 2] });
  const [zero, one] = [0, 1].map((player) => evaluatorFor(game, 0, player).score(sides[player]));
  return zero === one ? 0 : Number(one > zero);
}

describe("the extension's border rules (border-rules.js, docs/extension.md)", () => {
  it("leave a border with no figure to the game's own evaluator", () => {
    const game = newGame();
    assert.equal(evaluatorFor(game, 0, 0), game.evaluator);
    game.borders[0].figures = [null, null];
    assert.equal(evaluatorFor(game, 3, 1), game.evaluator);
  });

  it("Valet de Trèfle: -10 penalty on tie-break / sum for whoever laid it", () => {
    const straightA = cards("5♠", "6♥", "7♦"); // sum 18
    const straightB = cards("5♣", "6♦", "7♥"); // sum 18
    assert.equal(winnerOf(newGame(), [straightA, straightB], [null, null]), 0, "equal sum without figure goes to first completed (player 0)");
    assert.equal(winnerOf(newGame(), [straightA, straightB], [id("minusTen"), null]), 1, "with V♣ on player 0's side, 18 - 10 = 8 loses to 18");
    assert.equal(winnerOf(newGame(), [straightA, straightB], [null, id("minusTen")]), 0, "with V♣ on player 1's side, player 1 loses");
  });

  it("Valet de Carreau: only the sums count", () => {
    const lowRun = cards("1♥", "2♥", "3♥");
    const bigSum = cards("10♠", "9♥", "7♦");
    assert.equal(winnerOf(newGame(), [lowRun, bigSum], [null, null]), 0);
    assert.equal(winnerOf(newGame(), [lowRun, bigSum], [null, id("sum")]), 1);
  });

  it("Roi de Pique: three odd cards of one suit beat a suited run, for both sides, never with a joker", () => {
    const odd = cards("1♥", "3♥", "7♥");
    const run = cards("4♠", "5♠", "6♠");
    assert.equal(winnerOf(newGame(), [odd, run], [null, null]), 1);
    assert.equal(winnerOf(newGame(), [odd, run], [null, id("oddFlush")]), 0, "the odd colour counts for the side that did not lay the King too");
    assert.equal(winnerOf(newGame(), [cards("1♥", "3♥", "JK"), run], [id("oddFlush"), null]), 1);
  });

  it("Roi de Carreau: +10 to a run, for the side that laid it only", () => {
    const small = cards("5♠", "6♥", "7♦");
    const big = cards("8♣", "9♠", "10♥");
    assert.equal(winnerOf(newGame(), [small, big], [null, null]), 1);
    assert.equal(winnerOf(newGame(), [small, big], [id("plusTen"), null]), 0, "5-6-7 + 10 = 28 beats 27");
    assert.equal(winnerOf(newGame(), [small, big], [null, id("plusTen")]), 1);
  });

  it("add up: the Valet de Trèfle and Roi de Carreau apply their bonuses/penalties independently", () => {
    const small = cards("5♠", "6♥", "7♦");
    const big = cards("8♣", "9♠", "10♥");
    assert.equal(winnerOf(newGame(), [small, big], [id("plusTen"), id("minusTen")]), 0);
  });

  it("record what decided the border under its figures (decidedBy in settle.js)", () => {
    const decided = (sides, figures) => {
      const game = newGame();
      Object.assign(game.borders[0], { sides, figures, completedAt: [1, 2] });
      resolveBorder(game, 0);
      return game.resolved.at(-1).decidedBy;
    };
    const straightA = cards("5♠", "6♥", "7♦");
    const straightB = cards("5♣", "6♦", "7♥");
    assert.equal(decided([straightA, straightB], [null, null]), "first");
    assert.equal(decided([straightA, straightB], [id("minusTen"), null]), "sum", "18 - 10 against 18");
    assert.equal(decided([cards("1♥", "2♥", "3♥"), cards("10♠", "9♥", "7♦")], [null, id("sum")]), "sum", "La Somme: two formations judged on sums");
    assert.equal(decided([cards("1♥", "3♥", "7♥"), cards("4♠", "5♠", "6♠")], [null, id("oddFlush")]), "formation", "an odd flush above a suited run");
  });
});

describe("the extension's figure moves (figure-moves.js)", () => {
  it("lay a figure only beside an undecided border, one per border and player", () => {
    const game = newGame();
    game.hands[0] = [id("minusTen"), ...game.hands[0].filter((card) => !isFigure(card)).slice(0, 5)];
    game.borders[2].owner = 1;
    game.borders[4].figures[0] = id("sum");
    const borders = [...new Set(legalMoves(game).filter((move) => move.card === id("minusTen")).map((move) => move.border))];
    assert.deepEqual(borders, [0, 1, 3, 5, 6]);
  });

  it("Valet de Trèfle: discards a chosen card, draws two from pile, shuffles discard into pile, no draw at end of turn", () => {
    const game = newGame(42);
    const discardCard = cards("1♠")[0];
    game.hands[0] = [id("minusTen"), discardCard, ...cards("2♠", "3♠", "4♠", "5♠")];
    const initialPile = [...game.pile];
    const topCard1 = initialPile[initialPile.length - 1];
    const topCard2 = initialPile[initialPile.length - 2];
    const initialPileLen = game.pile.length;

    applyMove(game, { card: id("minusTen"), border: 0, discard: discardCard });

    assert.equal(game.borders[0].figures[0], id("minusTen"));
    assert.equal(game.hands[0].length, 6);
    assert.ok(!game.hands[0].includes(discardCard));
    assert.ok(game.pile.includes(discardCard));
    assert.ok(game.hands[0].includes(topCard1));
    assert.ok(game.hands[0].includes(topCard2));
    assert.equal(game.pile.length, initialPileLen - 1);
  });

  it("Valet de Trèfle: no discard once the pile is empty, one move a border then", () => {
    const game = newGame(3);
    game.hands[0] = [id("minusTen"), ...cards("1♠", "2♠", "3♠", "4♠", "5♠")];
    const withPile = legalMoves(game).filter((move) => move.card === id("minusTen"));
    assert.ok(withPile.some((move) => move.discard !== undefined), "a discard is offered while the pile lasts");
    assert.equal(withPile.filter((move) => move.border === 0).length, 6, "laid alone, or with any of the 5 other cards");
    game.pile = [];
    const empty = legalMoves(game).filter((move) => move.card === id("minusTen"));
    assert.deepEqual(empty.map((move) => move.border), [0, 1, 2, 3, 4, 5, 6]);
    assert.ok(empty.every((move) => move.discard === undefined));
  });

  it("Dame de Cœur: swaps her border with another undecided one, and stays with hers", () => {
    const game = newGame();
    game.hands[0] = [id("swap"), ...cards("1♠", "2♠", "3♠", "4♠", "5♠")];
    game.borders[1].sides[0] = cards("9♥");
    game.borders[5].sides[1] = cards("8♦");
    const before = game.pile.length;
    applyMove(game, { card: id("swap"), border: 1, target: 5 });
    assert.deepEqual(game.borders[5].sides[0], cards("9♥"));
    assert.equal(game.borders[5].figures[0], id("swap"));
    assert.deepEqual(game.borders[1].sides[1], cards("8♦"));
    assert.equal(game.borders[1].figures[0], null, "the other border keeps its place free");
    assert.equal(game.pile.length, before - 1, "the player draws after it");
  });

  it("Dame de Pique: takes back the last card laid there, without drawing; a full side is full no more", () => {
    const game = newGame();
    game.hands[0] = [id("recall"), ...cards("1♠", "2♠", "3♠", "4♠", "5♠")];
    game.borders[3].sides[0] = cards("7♥", "8♥", "9♥");
    game.borders[3].completedAt[0] = 5;
    const before = game.pile.length;
    applyMove(game, { card: id("recall"), border: 3 });
    assert.deepEqual(game.borders[3].sides[0], cards("7♥", "8♥"));
    assert.equal(game.borders[3].completedAt[0], Infinity);
    assert.equal(game.hands[0].length, 6);
    assert.ok(game.hands[0].includes(cards("9♥")[0]));
    assert.equal(game.pile.length, before, "no draw after a Rappel");
  });
});

describe("whole games with the six figures", () => {
  it("are played out by the bots, the figures laid, and read back from their log", () => {
    let laid = 0;
    let discards = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const game = newGame(seed);
      const log = startLog(game, { rules: { deck: "classique", jokerRule: "colorless", order: "original", endMode: "claim-end" }, players: [], seed });
      const bots = [BOTS.strategist(createRng(seed)), BOTS.greedy(createRng(seed + 100))];
      for (let turns = 0; !game.over && turns < 200; turns += 1) {
        const moves = legalMoves(game);
        playLogged(log, game, moves.length > 0 ? bots[game.current].choose(game, moves) : null);
      }
      assert.ok(game.over, `game ${seed} ends`);
      finishLog(log, game);
      laid += game.borders.filter((border) => border.figures.some((figure) => figure !== null)).length;
      // A Valet de Trèfle laid with a discard draws during the move, so its log entry draws nothing after it.
      for (const entry of log.turns.filter((turn) => turn.move?.discard !== undefined)) {
        assert.equal(entry.drew, null, `game ${seed}, turn ${entry.turn}`);
        discards += 1;
      }
      const frames = replayStates(log);
      assert.equal(frames.at(-1).state.winner, game.winner, `game ${seed} reads back`);
    }
    assert.ok(laid > 12, `figures were laid (${laid})`);
    assert.ok(discards > 0, "the bots laid a Valet de Trèfle with a discard, and it read back");
  });
});
