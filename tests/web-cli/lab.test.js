import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { borderTones, cardTones, referenceOf, toneOf, tonedCandidates } from "../../web/app/lab/confidence.js";
import { DIAGNOSIS, diagnose } from "../../web/app/lab/tree-diagnosis.js";
import { bandLabel, layoutTree, nodeAt, pathTo, rateHue, visitBuckets } from "../../web/app/lab/tree-layout.js";

/** A root candidate as `rootStats` writes it. */
const candidate = (key, visits, [rate, low, high], extra = {}) => {
  const [card, border] = key.split("@").map(Number);
  return { key, move: { card, border }, visits, wins: rate * visits, rate, low, high, share: 0, coreRank: 1, ...extra };
};

const ROOT = [
  candidate("1@0", 500, [0.62, 0.58, 0.66], { share: 0.5, coreRank: 1 }),
  candidate("1@2", 300, [0.6, 0.55, 0.65], { share: 0.3, coreRank: 2 }),
  candidate("4@1", 150, [0.5, 0.42, 0.58], { share: 0.15, coreRank: 3 }),
  candidate("7@3", 40, [0.3, 0.17, 0.46], { share: 0.04, coreRank: 4 }),
  candidate("9@5", 10, [0.2, 0.05, 0.5], { share: 0.01, coreRank: 5 }),
];

const node = (key, [visits, wins], children = [], extra = {}) => ({ key, visits, wins, avail: visits, mover: 0, children, ...extra });

describe("the Labo's card tones (confidence.js)", () => {
  it("measures every candidate against the move played", () => {
    const reference = referenceOf(ROOT, { card: 1, border: 0 });
    assert.equal(reference.key, "1@0");
    assert.deepEqual(
      tonedCandidates(ROOT, { card: 1, border: 0 }).map((entry) => entry.tone),
      ["sure", "sure", "maybe", "poor", "poor"],
    );
    assert.equal(toneOf(candidate("2@2", 0, [null, 0, 1]), reference), "unseen");
  });

  it("falls back on the most visited when no move is given", () => {
    assert.equal(referenceOf(ROOT, null).key, "1@0");
  });

  it("gives each card of the hand its best candidate's tone, unseen when none plays it", () => {
    const tones = cardTones(ROOT, { card: 1, border: 0 }, [1, 4, 7, 11]);
    assert.deepEqual([...tones].map(([card, { tone }]) => [card, tone]), [[1, "sure"], [4, "maybe"], [7, "poor"], [11, "unseen"]]);
    assert.equal(tones.get(1).entry.key, "1@0", "the card's most visited move");
  });

  it("lights the borders a card goes to", () => {
    const borders = borderTones(ROOT, { card: 1, border: 0 }, 1);
    assert.deepEqual([...borders.keys()], [0, 2]);
    assert.equal(borders.get(2).tone, "sure");
  });
});

describe("the Labo's tree drawing (tree-layout.js)", () => {
  const snapshot = node("root", [20, 0], [
    node("1@0", [12, 7], [node("5@1", [8, 3], [node("2@2", [5, 3], [node("3@3", [2, 1])])]), node("6@1", [4, 2])], { hidden: { count: 3, visits: 0, wins: 0 } }),
    node("2@0", [8, 3]),
  ]);

  it("centres each parent over its children, one band per ply, folded below the open plies", () => {
    const { nodes, links, bands } = layoutTree(snapshot, { open: 3 });
    const at = (id) => nodes.find((entry) => entry.id === id);
    assert.equal(at("1@0").x, (at("1@0/5@1").x + at("1@0/+").x) / 2);
    assert.equal(at("1@0/+").hidden, 3);
    assert.equal(at("1@0/5@1/2@2").folded, 1, "the 4th ply is folded");
    assert.equal(at("1@0/5@1/2@2/3@3"), undefined);
    assert.equal(bands.length, 4);
    assert.ok(at("1@0").r > at("2@0").r, "more visits, a larger node");
    assert.equal(links.length, nodes.length - 1);
    assert.equal(at("1@0").rate, 7 / 12);
  });

  it("unfolds a node on demand", () => {
    const { nodes } = layoutTree(snapshot, { open: 3, expanded: new Set(["1@0/5@1/2@2"]) });
    assert.ok(nodes.some((entry) => entry.id === "1@0/5@1/2@2/3@3"));
  });

  it("draws a node's 3 most visited children, the rest in its « +n » node until that node is widened", () => {
    const wide = node("root", [30, 0], [1, 5, 2, 9, 3].map((visits, index) => node(`${index}@0`, [visits, 1])));
    const at = (nodes, id) => nodes.find((entry) => entry.id === id);
    const { nodes } = layoutTree(wide);
    assert.deepEqual(nodes.filter((entry) => entry.depth === 1 && !entry.hidden).map((entry) => entry.key).sort(), ["1@0", "3@0", "4@0"]);
    assert.deepEqual([at(nodes, "+").hidden, at(nodes, "+").visits, at(nodes, "+").wins], [2, 3, 2]);
    const all = layoutTree(wide, { expanded: new Set(["+"]) }).nodes;
    assert.equal(all.filter((entry) => entry.depth === 1).length, 5);
    assert.equal(at(all, "+"), undefined);
  });

  it("draws 2 children from ply 2, ply 4 under the best two candidates and ply 5 under the best one", () => {
    const chain = (prefix, depth) => (depth > 6 ? [] : [3, 2, 1].map((visits, index) => node(`${index}@${depth}`, [visits * (7 - depth), 1], chain(`${prefix}${index}`, depth + 1))));
    const deep = node("root", [100, 0], chain("", 1));
    const { nodes } = layoutTree(deep);
    const real = nodes.filter((entry) => !entry.hidden);
    const under = (rank, depth) => real.filter((entry) => entry.depth === depth && entry.id.startsWith(`${rank}@1`)).length;
    assert.deepEqual([1, 2, 3, 4, 5].map((depth) => real.filter((entry) => entry.depth === depth).length), [3, 6, 12, 16, 16]);
    assert.deepEqual([under(0, 4), under(1, 4), under(2, 4)], [8, 8, 0]);
    assert.deepEqual([under(0, 5), under(1, 5)], [16, 0]);
    assert.equal(Math.max(...nodes.map((entry) => entry.depth)), 5);
  });

  it("walks a path back from an id", () => {
    assert.deepEqual(pathTo(snapshot, "1@0/5@1/2@2").map((entry) => entry.key), ["1@0", "5@1", "2@2"]);
    assert.equal(nodeAt(snapshot, "").key, "root");
    assert.equal(nodeAt(snapshot, "9@9"), null);
  });

  it("colours, names and buckets", () => {
    assert.deepEqual([rateHue(0.2), rateHue(0.5), rateHue(0.9), rateHue(null)], [0, 60, 120, null]);
    assert.equal(bandLabel(2), "Pli 2 · réponses de l'adversaire");
    assert.equal(bandLabel(3), "Pli 3 · ses réponses");
    const buckets = visitBuckets(snapshot, 2, [2, 5]);
    assert.deepEqual(buckets.map((bucket) => bucket.count), [0, 1, 1]);
  });
});

describe("the Labo's diagnosis (tree-diagnosis.js)", () => {
  const name = (move) => `${move.card}→${move.border + 1}`;

  it("flags an uncertain choice, a starved candidate and a better rate elsewhere", () => {
    const ids = diagnose({ root: ROOT, trees: [] }, { card: 1, border: 0 }, { name }).map((finding) => finding.id);
    assert.ok(ids.includes("uncertain"));
    assert.ok(ids.includes("starved"));
    assert.ok(!ids.includes("visits-vs-rate"));
    const swapped = [candidate("1@0", 500, [0.55, 0.51, 0.59]), candidate("1@2", 300, [0.7, 0.65, 0.75])];
    assert.ok(diagnose({ root: swapped, trees: [] }, null, { name }).some((finding) => finding.id === "visits-vs-rate"));
  });

  it("says when the core ranked the move far down", () => {
    const root = [candidate("9@5", 600, [0.7, 0.66, 0.74], { coreRank: DIAGNOSIS.coreRank }), candidate("1@0", 100, [0.4, 0.3, 0.5])];
    assert.ok(diagnose({ root, trees: [] }, { card: 9, border: 5 }, { name }).some((finding) => finding.id === "core-dislike"));
  });

  it("finds a refutation under the move played, a flat third ply and a depth never reached", () => {
    const snapshot = node("root", [100, 0], [node("1@0", [100, 50], [node("5@1", [40, 32]), node("6@1", [30, 12]), node("7@1", [30, 12])])]);
    const levels = [{ depth: 1, nodes: 1, zero: 0, one: 0, max: 100 }, { depth: 2, nodes: 3, zero: 0, one: 0, max: 40 }, { depth: 3, nodes: 10, zero: 1, one: 8, max: 2 }];
    const findings = diagnose({ root: [candidate("1@0", 100, [0.5, 0.4, 0.6])], trees: [{ snapshot, levels }] }, { card: 1, border: 0 }, { name, depth: 5 });
    const ids = findings.map((finding) => finding.id);
    assert.deepEqual(ids.filter((id) => ["refutation", "flat", "shallow"].includes(id)), ["refutation", "flat", "shallow"]);
    assert.match(findings.find((finding) => finding.id === "refutation").text, /5→2/);
  });

  it("says an endgame was solved, and nothing without a report", () => {
    assert.deepEqual(diagnose({ exact: true }, null).map((finding) => finding.id), ["exact"]);
    assert.deepEqual(diagnose(null, null), []);
  });
});
