import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MARKERS, injectRulesStats } from "../../src/report/rules-stats.js";

const sheet = readFileSync(new URL("../../regles/regles.html", import.meta.url), "utf8");

describe("the statistics block of the rules sheet", () => {
  it("has its two markers, once each, in order", () => {
    assert.equal(sheet.split(MARKERS.start).length, 2);
    assert.equal(sheet.split(MARKERS.end).length, 2);
    assert.ok(sheet.indexOf(MARKERS.start) < sheet.indexOf(MARKERS.end));
  });

  it("replaces only what lies between the markers", () => {
    const html = `avant\n${MARKERS.start}\nancien\n${MARKERS.end}\naprès`;
    const block = `${MARKERS.start}\nnouveau\n${MARKERS.end}`;
    assert.equal(injectRulesStats(html, block), `avant\n${block}\naprès`);
  });

  it("refuses a sheet whose markers are gone", () => {
    assert.throws(() => injectRulesStats("<p>rien</p>", "x"));
  });

  it("no longer carries the tarot variant", () => {
    assert.ok(!/tarot/i.test(sheet));
  });
});
