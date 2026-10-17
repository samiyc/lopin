import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOT_IDS, BOT_LINEUP, DEFAULT_OPPONENT, botTag, engineOf, isShownPlayer, playerTag, shortTag, shortVersion } from "../../src/config/bots.js";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS, engineFor } from "../../src/sim/bots.js";
import { createGame, legalMoves } from "../../src/sim/engine/game.js";

describe("the bot line-up", () => {
  it("has the lineup bots, each on an existing engine", () => {
    assert.deepEqual(BOT_IDS, ["basique", "stratege", "experimental", "oracle-light"]);
    for (const id of BOT_IDS) assert.doesNotThrow(() => engineFor(engineOf(id)), id);
    assert.ok(BOT_IDS.includes(DEFAULT_OPPONENT));
  });

  it("thinks in the page with no setting the worker skips, so the page plays the duels' bot", () => {
    // think-worker.js searches with `searchFor` alone: the budget scales (late, early, smart), the pivot, tree reuse,
    // the opponent memory and a clock budget (@t) of `scoreMoves` never run there (the review panel, 16/10).
    for (const id of BOT_IDS.filter((bot) => BOT_LINEUP[bot].think)) assert.doesNotMatch(engineOf(id), /\+(late|early|smart|pivot|reuse|memory)=|@t\d/, id);
  });

  it("gives a bot thinking on several workers one tree per worker", () => {
    for (const id of BOT_IDS) {
      const workers = BOT_LINEUP[id].think?.workers ?? 1;
      const trees = Number(/\+trees=(\d+)/.exec(engineOf(id))?.[1] ?? 1);
      assert.equal(workers, trees, id);
    }
  });

  it("gives every bot a two-number version and a tag for the replays", () => {
    for (const id of BOT_IDS) assert.match(BOT_LINEUP[id].version, /^\d+\.\d+$/);
    assert.equal(botTag("stratege"), `stratege@${BOT_LINEUP.stratege.version}`);
  });

  it("reads a version saved with three numbers as the same version", () => {
    assert.equal(shortVersion("2.1.0"), "2.1");
    assert.equal(shortVersion("1.0"), "1.0");
    assert.equal(shortTag("stratege@2.1.0"), "stratege@2.1");
    assert.equal(shortTag("ismcts+widen=3+depth=5@800"), "ismcts+widen=3+depth=5@800", "an engine id is left alone");
    assert.equal(shortTag("Sami"), "Sami");
    assert.equal(playerTag({ bot: "experimental", version: "1.0.0" }), "experimental@1.0");
    assert.ok(isShownPlayer("experimental@1.0.0") && isShownPlayer("experimental@1.0"));
  });

  it("refuses an unknown bot", () => {
    assert.throws(() => engineOf("champion"));
  });
});

describe("scoreMoves", () => {
  const state = createGame(DECKS.classique, {
    order: ORDERS.original,
    jokerRule: JOKER_RULES.colorless,
    rng: createRng(5),
  });
  const moves = legalMoves(state);

  for (const id of ["random", "greedy", "strategist", "lookahead", "experimental"]) {
    it(`${id} scores candidates, and its choice is among the best scored`, () => {
      const bot = BOTS[id](createRng(1));
      const scored = bot.scoreMoves(state, moves);
      assert.ok(scored.length > 0 && scored.length <= moves.length);
      const choice = bot.choose(state, moves);
      if (id === "random") return;
      const top = Math.max(...scored.map((entry) => entry.gain));
      const chosen = scored.find((entry) => entry.move.card === choice.card && entry.move.border === choice.border);
      assert.ok(Math.abs(chosen.gain - top) < 1e-9);
    });
  }

  it("the experimental bot searches deeper from the same core: more candidates, more rollouts", () => {
    const core = BOTS.strategist(createRng(1)).scoreMoves(state, moves);
    const deep = engineFor("experimental:120")(createRng(1)).scoreMoves(state, moves);
    const searched = deep.filter((entry) => entry.rollouts > 0);
    assert.equal(searched.length, 8, "eight candidates, against the Stratège's four");
    const shortlist = [...core].sort((x, y) => y.gain - x.gain).slice(0, 8).map(({ move }) => `${move.card}@${move.border}`);
    for (const { move } of searched) assert.ok(shortlist.includes(`${move.card}@${move.border}`));
    assert.ok(searched.some((entry) => entry.rollouts > 16), "rollouts go to the survivors");
  });
});

describe("the page's line-up", () => {
  it("builds every bot the way the page does, whatever its engine id", async () => {
    // The page once looked engines up in BOTS directly, and broke when Expérimental 0.8 became `ismcts@800`.
    const { botPlayer } = await import("../../web/app/replays/runner.js");
    for (const id of BOT_IDS) assert.equal(typeof botPlayer(id, 1).bot.choose, "function", id);
  });
});
