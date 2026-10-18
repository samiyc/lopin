/**
 * One-shot (Sami, 18/10, `+mirror=1`): at the first move of `n` deals, the 1.2 with and without mirror moves — how
 * often its move changes (a mirror move counts as the same), how many distinct cards its 8 candidates hold, and the
 * win rate it gives its move; the control is the plain 1.2 from another seed. `node scripts/archive/mirror-turn1.js [n] [budget]`.
 */
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { createGame, legalMoves } from "../../src/sim/engine/game.js";
import { moveKey } from "../../src/sim/search/search.js";

const [n = 30, budget = 2000] = process.argv.slice(2).map(Number);
const BASE = "ismcts+widen=7+depth=5+core=stfig6+exact=12";
const canonical = (move) => `${move.card}@${Math.min(move.border, 6 - move.border)}`;

function searchOf(id, state, seed) {
  const search = engineFor(`${id}@${budget}`)(createRng(seed)).searchFor(state, legalMoves(state), {});
  for (let i = 0; i < budget; i += 1) search.step();
  const root = search.tree();
  const best = search.best();
  const child = root.children.get(moveKey(best));
  return { best, cards: new Set(search.candidates().map((move) => move.card)).size, rate: child.wins / child.visits };
}

const tally = { same: 0, sameCard: 0, control: 0, controlCard: 0, cards: [0, 0], rate: [0, 0] };
for (let deal = 0; deal < n; deal += 1) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(9000 + deal), endMode: "claim-end" });
  const [plain, mirror] = [BASE, `${BASE}+mirror=1`].map((id) => searchOf(id, state, 77 + deal));
  tally.same += canonical(plain.best) === canonical(mirror.best);
  tally.sameCard += plain.best.card === mirror.best.card;
  // The control: the plain 1.2 again, from another seed — how much the first move changes on its own.
  const again = searchOf(BASE, state, 177 + deal);
  tally.control += canonical(plain.best) === canonical(again.best);
  tally.controlCard += plain.best.card === again.best.card;
  [plain, mirror].forEach((side, i) => {
    tally.cards[i] += side.cards;
    tally.rate[i] += side.rate;
  });
}
const avg = (pair) => pair.map((value) => (value / n).toFixed(3)).join(" → ");
console.log(`${n} donnes à ${budget} : même coup (au miroir près) ${tally.same}, même carte ${tally.sameCard} (témoin, la 1.2 sur une autre graine : ${tally.control} et ${tally.controlCard}) ; cartes parmi les 8 candidats ${avg(tally.cards)} ; taux du coup joué ${avg(tally.rate)}`);
