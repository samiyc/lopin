import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClock, formatDuration, formatMinutes, formatThinking } from "../../web/app/board/clock.js";

describe("the game clock", () => {
  const fakeTime = () => {
    let t = 1000;
    return { now: () => t, advance: (ms) => (t += ms) };
  };

  it("times a move from its mark, leaving out the time it was paused", () => {
    const time = fakeTime();
    const clock = createClock(time.now);
    time.advance(3000); // the bot's turn
    clock.mark();
    time.advance(4000);
    clock.pause(); // a note taken in another window
    time.advance(60000);
    clock.resume();
    time.advance(2000);
    assert.equal(clock.sinceMark(), 6000);
    assert.equal(clock.mark(), 6000);
    assert.equal(clock.active(), 9000);
  });

  it("ignores a second pause or resume", () => {
    const time = fakeTime();
    const clock = createClock(time.now);
    clock.pause();
    clock.pause();
    time.advance(5000);
    assert.equal(clock.isRunning(), false);
    clock.resume();
    clock.resume();
    time.advance(1000);
    assert.equal(clock.active(), 1000);
  });

  it("reads as minutes and seconds", () => {
    assert.equal(formatDuration(7400), "0:07");
    assert.equal(formatDuration(765000), "12:45");
    assert.equal(formatDuration(-5), "0:00");
  });

  it("says how long a move and a game took", () => {
    assert.equal(formatThinking(45200), "45 s");
    assert.equal(formatThinking(64000), "1 min 04 s");
    assert.equal(formatThinking(150000), "2 min 30 s");
    assert.equal(formatMinutes(1260000), "21 min");
    assert.equal(formatMinutes(20000), "1 min");
  });
});
