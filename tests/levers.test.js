import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../src/config/decks.js";
import { ORDERS } from "../src/config/formations.js";
import { createRng } from "../src/core/random.js";
import { BOTS, engineFor, pickSampled } from "../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../src/sim/game.js";
import { pointsOf } from "../src/sim/choice.js";
import { createIsmcts, isPivot, ismctsSettings } from "../src/sim/ismcts.js";
import { pickCandidates, resolveDiverse, treeDiverseOf } from "../src/sim/pick.js";
import { EXPERIMENT } from "../src/sim/experimental.js";
import { HABITS } from "../src/sim/strategist.js";
import { rolloutPolicyOf, strategistBot } from "../src/sim/bots.js";

const spec = DECKS.classique;
const rules = { order: ORDERS.original, jokerRule: JOKER_RULES.colorless };

/** A position `moves` moves into a seeded game between two strategists. */
function position(seed, moves) {
  const rng = createRng(seed);
  const bots = [BOTS.strategist(rng), BOTS.strategist(rng)];
  const state = createGame(spec, { ...rules, rng, endMode: "claim-end" });
  while (!state.over && state.turn < moves) applyMove(state, bots[state.current].choose(state, legalMoves(state)));
  return state;
}

describe("sampled rollouts", () => {
  it("draw the favourite almost always when cold, and spread out when warm", () => {
    const scored = [{ move: "a", gain: 0.5 }, { move: "b", gain: 0.4 }, { move: "c", gain: 0 }];
    const count = (temperature) => {
      const rng = createRng(3);
      return Array.from({ length: 2000 }, () => pickSampled(scored, rng, temperature)).filter((move) => move === "a").length;
    };
    assert.ok(count(0.01) > 1990);
    assert.ok(count(0.2) < 1600 && count(0.2) > 800);
  });
});

/** A whole game between engine `id` and the greedy bot, to its end. */
function playsThrough(id) {
  const rng = createRng(2);
  const bots = [engineFor(id)(rng), BOTS.greedy(rng)];
  const state = createGame(spec, { ...rules, rng, endMode: "claim-end" });
  while (!state.over) {
    const moves = legalMoves(state);
    applyMove(state, moves.length ? bots[state.current].choose(state, moves) : null);
  }
  return state;
}

describe("ISMCTS", () => {
  it("spends its budget on the core's shortlist and names a legal move", () => {
    const state = position(4, 9);
    const moves = legalMoves(state);
    const base = strategistBot(createRng(1), EXPERIMENT);
    const search = createIsmcts(state, base.scoreMoves(state, moves), { policy: rolloutPolicyOf(EXPERIMENT), seed: 7 });
    for (let i = 0; i < 60; i += 1) search.step();
    const visits = search.scored().filter((entry) => entry.gain >= 0);
    assert.equal(search.rollouts(), 60);
    assert.equal(visits.reduce((sum, entry) => sum + entry.gain, 0), 60, "every iteration visits one root move");
    assert.ok(moves.includes(search.best()));
  });

  it("counts a share of the border lead with margin, and nothing else without it", () => {
    const game = { borders: [0, 0, 0, 0, 0, 1, 1].map((owner) => ({ owner })) };
    assert.equal(pointsOf(game, 0, 0)(0), 1);
    assert.equal(pointsOf(game, 0, 0)(1), 0);
    const points = pointsOf(game, 0, 0.2);
    assert.ok(Math.abs(points(0) - (0.8 + 0.2 * (0.5 + 3 / 14))) < 1e-12, "5 to 2: a lead of 3 over 7");
    assert.ok(Math.abs(points(0) + points(1) - 1) < 1e-12, "the two players' points still add up to 1");
    assert.equal(pointsOf(game, { share: 0.6 }, 0.2)(0), 0.6, "a cut-short rollout keeps its odds");
  });

  it("shares the budget between the trees of an ensemble, and adds up their root visits", () => {
    const state = position(4, 9);
    const moves = legalMoves(state);
    const base = strategistBot(createRng(1), EXPERIMENT);
    const search = createIsmcts(state, base.scoreMoves(state, moves), { policy: rolloutPolicyOf(EXPERIMENT), seed: 7, trees: 3 });
    for (let i = 0; i < 60; i += 1) search.step();
    const visits = search.scored().filter((entry) => entry.gain >= 0);
    assert.equal(search.rollouts(), 60);
    assert.equal(visits.reduce((sum, entry) => sum + entry.gain, 0), 60, "every iteration of every tree visits one root move");
    assert.ok(moves.includes(search.best()));
  });

  it("explores the core's favourite longer with a prior (puct)", () => {
    const state = position(4, 9);
    const moves = legalMoves(state);
    const base = strategistBot(createRng(1), EXPERIMENT);
    const scored = base.scoreMoves(state, moves);
    const first = pickCandidates(scored, 8)[0];
    const visitsOf = (puct) => {
      const search = createIsmcts(state, scored, { policy: rolloutPolicyOf(EXPERIMENT), seed: 7, puct });
      for (let i = 0; i < 120; i += 1) search.step();
      return search.scored().find((entry) => entry.move === first).gain;
    };
    assert.ok(visitsOf(4) > visitsOf(0), "a strong prior sends more visits to the core's first move");
  });

  it("plays whole games as an engine, with every way of searching deeper", () => {
    for (const id of ["ismcts@40", "ismcts+puct=2@40", "ismcts+trees=2@40", "ismcts+simCertain=1@30", "ismcts+margin=0.15@30", "ismcts+simCertain=1+simExact=4@30", "ismcts+pw=1+widen=6+depth=5@40", "ismcts+rave=300@40", "ismcts+exact=12+hope=1@40", "ismcts+widen=3+depth=5+core=nb1@30", "ismcts+shortlist=plain+rollout=nb2@30", "core:plain"]) assert.ok(playsThrough(id).over, id);
  });

  it("marks the move after the opponent has started all seven borders, once", () => {
    const pivots = [];
    const state = position(6, 0);
    const bot = BOTS.strategist(createRng(1));
    while (!state.over && state.pile.length > 0) {
      if (isPivot(state)) pivots.push(state.current);
      applyMove(state, bot.choose(state, legalMoves(state)));
    }
    assert.ok(pivots.length >= 1 && pivots.length <= 2, `${pivots}`);
    assert.equal(new Set(pivots).size, pivots.length, "once for each player at most");
  });

  it("solves the empty pile exactly up to the cards asked", () => {
    const state = position(8, 0);
    const bot = BOTS.strategist(createRng(1));
    while (state.pile.length > 0 && !state.over) applyMove(state, bot.choose(state, legalMoves(state)));
    const moves = legalMoves(state);
    const cards = state.hands[0].length + state.hands[1].length;
    assert.equal(engineFor("ismcts@40")(createRng(1)).solves(state, moves), cards <= 8);
    assert.equal(engineFor("ismcts+exact=12@40")(createRng(1)).solves(state, moves), moves.length > 1);
  });
});

describe("ideas for the first turns only", () => {
  it("play their ideas before earlyUntil, and the plain core from then on", () => {
    const weights = { ...EXPERIMENT.weights, stay: 0.6, stayFigure: 1 };
    const early = strategistBot(createRng(1), { ...EXPERIMENT, earlyIdeas: ["stay"], earlyUntil: 10, weights });
    const always = strategistBot(createRng(1), { ...EXPERIMENT, ideas: [...EXPERIMENT.ideas, "stay"], weights });
    const plain = strategistBot(createRng(1), EXPERIMENT);
    const gains = (bot, state) => bot.scoreMoves(state, legalMoves(state)).map(({ gain }) => gain);
    const [before, after] = [position(3, 8), position(3, 14)];
    assert.deepEqual(gains(early, before), gains(always, before));
    assert.deepEqual(gains(early, after), gains(plain, after));
    assert.notDeepEqual(gains(always, after), gains(plain, after), "the idea does weigh at turn 14 when it is on");
  });
});

describe("habits for the first turns only", () => {
  it("play a habit before earlyUntil, and leave it from then on", () => {
    const withoutJoker = HABITS.filter((habit) => habit !== "joker");
    const early = strategistBot(createRng(1), { ...EXPERIMENT, habits: withoutJoker, earlyHabits: ["joker"], earlyUntil: 10 });
    const always = strategistBot(createRng(1), EXPERIMENT);
    const never = strategistBot(createRng(1), { ...EXPERIMENT, habits: withoutJoker });
    const scores = (bot, state) => bot.scoreMoves(state, legalMoves(state)).map(({ move, gain }) => `${move.card}:${move.border}:${gain}`);
    const [before, after] = [position(5, 6), position(5, 16)];
    assert.deepEqual(scores(early, before), scores(always, before));
    assert.deepEqual(scores(early, after), scores(never, after));
  });
});

describe("ideas for the end of the game only", () => {
  it("leave an idea out before lateFrom, and play it from then on", () => {
    const without = EXPERIMENT.ideas.filter((idea) => idea !== "spread");
    const late = strategistBot(createRng(1), { ...EXPERIMENT, ideas: without, lateIdeas: ["spread"], lateFrom: 15 });
    const always = strategistBot(createRng(1), EXPERIMENT);
    const never = strategistBot(createRng(1), { ...EXPERIMENT, ideas: without });
    const scores = (bot, state) => bot.scoreMoves(state, legalMoves(state)).map(({ move, gain }) => `${move.card}:${move.border}:${gain}`);
    const [before, after] = [position(7, 6), position(7, 18)];
    assert.deepEqual(scores(late, before), scores(never, before));
    assert.deepEqual(scores(late, after), scores(always, after));
    assert.notDeepEqual(scores(always, before), scores(never, before), "spread does weigh at turn 6");
  });
});

describe("root candidate diversity (pickCandidates, ismcts+diverse)", () => {
  it("diverse=1 selects one move per distinct card first, then fills by gain", () => {
    const scored = [
      { move: { card: 1, border: 0 }, gain: 0.9 },
      { move: { card: 1, border: 1 }, gain: 0.8 },
      { move: { card: 1, border: 2 }, gain: 0.7 },
      { move: { card: 2, border: 0 }, gain: 0.6 },
      { move: { card: 2, border: 1 }, gain: 0.5 },
      { move: { card: 3, border: 0 }, gain: 0.4 },
      { move: { card: 4, border: 0 }, gain: 0.3 },
    ];
    // Baseline picks [1:0, 1:1, 1:2, 2:0] (only cards 1 and 2)
    assert.deepEqual(pickCandidates(scored, 4, 0).map((m) => m.card), [1, 1, 1, 2]);
    // Diverse=1 picks [1:0, 2:0, 3:0, 4:0] (all 4 distinct cards)
    assert.deepEqual(pickCandidates(scored, 4, 1).map((m) => m.card), [1, 2, 3, 4]);
    // Diverse=2 caps at 2 per card: [1:0, 1:1, 2:0, 2:1]
    assert.deepEqual(pickCandidates(scored, 4, 2).map((m) => m.card), [1, 1, 2, 2]);
    // Diverse=lead2 / 2-1 gives 2 to the lead card and 1 to others: [1:0, 1:1, 2:0, 3:0]
    assert.deepEqual(pickCandidates(scored, 4, "lead2").map((m) => m.card), [1, 1, 2, 3]);
    // Too few cards for the cap: the rest is filled by gain, never left short.
    assert.deepEqual(pickCandidates(scored, 4, "2-1").map((m) => m.card), [1, 1, 2, 3]);
    // Diverse=cap321 / 321 gives 3 to lead, 2 to 2nd, 1 to others:
    // With candidates=4: [1, 1, 1, 2]
    assert.deepEqual(pickCandidates(scored, 4, "cap321").map((m) => m.card), [1, 1, 1, 2]);
    // With candidates=6: [1, 1, 1, 2, 2, 3]
    assert.deepEqual(pickCandidates(scored, 6, "cap321").map((m) => m.card), [1, 1, 1, 2, 2, 3]);
    // With candidates=7: [1, 1, 1, 2, 2, 3, 4] (4 distinct cards)
    assert.deepEqual(pickCandidates(scored, 7, "cap321").map((m) => m.card), [1, 1, 1, 2, 2, 3, 4]);
  });

  it("diverse=2 runs ISMCTS search down the tree with cap at 2 everywhere", () => {
    const spec = { borders: 3, handSize: 3, values: 5, colors: 2, jokers: 0, suits: ["♠", "♥"] };
    const game = createGame(spec, { order: ["sum"], jokerRule: "colorless", rng: createRng(42) });
    const moves = legalMoves(game);
    const scored = moves.map((move) => ({ move, gain: move.border === 0 ? 0.9 : 0.1 }));
    const search = createIsmcts(game, scored, {
      budget: 20, candidates: 4, widen: 3, depth: 3, diverse: 2, seed: 123,
      policy: (r) => BOTS.strategist(r),
    });
    for (let i = 0; i < 20; i += 1) search.step();
    assert.equal(search.tree().visits, 0);
    assert.equal(search.tree().children.size, 4);
  });

  it("names its caps: cap321_2 is cap321 over the first four half-moves, then 2, and 2 under the root; an unknown name is refused", () => {
    assert.equal(resolveDiverse("cap321_2", { turn: 3 }), "cap321");
    assert.equal(resolveDiverse("cap321_2", { turn: 4 }), 2);
    assert.equal(resolveDiverse(2, { turn: 0 }), 2);
    assert.equal(treeDiverseOf("cap321_2"), 2);
    assert.equal(treeDiverseOf("cap321"), "cap321");
    assert.equal(ismctsSettings("ismcts+rootDiverse=cap321_2").rootDiverse, "cap321_2");
    assert.throws(() => ismctsSettings("ismcts+diverse=cap321t4"), /Diversité inconnue/);
  });

  it("rootDiverse=cap321_2 applies cap321 on turn < 4 and cap2 on turn >= 4", () => {
    const spec = { borders: 3, handSize: 4, values: 7, colors: 2, jokers: 0, suits: ["♠", "♥"] };
    const gameTurn1 = createGame(spec, { order: ["sum"], jokerRule: "colorless", rng: createRng(1) });
    gameTurn1.turn = 1; // Tour 2 (< 4)
    const gameTurn5 = createGame(spec, { order: ["sum"], jokerRule: "colorless", rng: createRng(1) });
    gameTurn5.turn = 4; // Tour 5 (>= 4)

    const scored = [
      { move: { card: 1, border: 0 }, gain: 0.9 },
      { move: { card: 1, border: 1 }, gain: 0.8 },
      { move: { card: 1, border: 2 }, gain: 0.7 },
      { move: { card: 2, border: 0 }, gain: 0.6 },
      { move: { card: 2, border: 1 }, gain: 0.5 },
      { move: { card: 3, border: 0 }, gain: 0.4 },
      { move: { card: 3, border: 1 }, gain: 0.35 },
      { move: { card: 4, border: 0 }, gain: 0.3 },
      { move: { card: 5, border: 0 }, gain: 0.2 },
    ];

    const searchEarly = createIsmcts(gameTurn1, scored, {
      budget: 10, candidates: 8, widen: 6, depth: 5, diverse: 2, rootDiverse: "cap321_2", seed: 10,
      policy: (r) => BOTS.strategist(r),
    });
    // On turn < 4, root cap321 allows 3 for lead (card 1), 2 for 2nd (card 2), 1 for others (3, 4, 5) -> 5 distinct cards!
    const cardsEarly = new Set(searchEarly.scored().filter((s) => s.gain >= 0).map((s) => s.move.card));
    assert.equal(cardsEarly.size, 5);

    const searchLate = createIsmcts(gameTurn5, scored, {
      budget: 10, candidates: 8, widen: 6, depth: 5, diverse: 2, rootDiverse: "cap321_2", seed: 10,
      policy: (r) => BOTS.strategist(r),
    });
    // On turn >= 4, root cap2 allows at most 2 per card -> cards 1 (2), 2 (2), 3 (1), 4 (1), 5 (1) -> max 2 per card!
    const cardCountsLate = {};
    searchLate.scored().filter((s) => s.gain >= 0).forEach((s) => {
      cardCountsLate[s.move.card] = (cardCountsLate[s.move.card] || 0) + 1;
    });
    assert.ok(Math.max(...Object.values(cardCountsLate)) <= 2);
  });
});

