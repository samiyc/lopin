import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * The machine's slots (Sami, 23/10: the scheduler in common): the jobs running on this machine, whatever runner
 * started them — this one, or mcts-commun's `mcts-backlog`, which plays the other projects' night measures. Both
 * read and write the same file, ~/.mcts-backlog/slots.json (`MCTS_BACKLOG_HOME`), with the same protocol as
 * mcts-commun's node/machine.js (kept a copy here: lopin does not depend on mcts-commun). A job takes its threads
 * before it starts and gives them back when it ends; it waits while they would pass what the machine lends, so two
 * runners never run an 18-thread job each at once. A job asking more than the whole budget runs alone.
 */
export const slotsHome = (env = process.env) => env.MCTS_BACKLOG_HOME || path.join(os.homedir(), ".mcts-backlog");

/** Is process `pid` still alive? */
export function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

const slotsFile = (home) => path.join(home, "slots.json");
const lockDir = (home) => path.join(home, "slots.lock");

async function withLock(home, work) {
  await mkdir(home, { recursive: true });
  for (let tries = 0; ; tries += 1) {
    try {
      await mkdir(lockDir(home));
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      // A lock left by a runner that died is taken over after a few seconds.
      if (tries > 200) await rm(lockDir(home), { recursive: true, force: true });
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try {
    return await work();
  } finally {
    await rm(lockDir(home), { recursive: true, force: true });
  }
}

/** The jobs running on the machine, those of dead processes left out. */
export async function readSlots(home = slotsHome()) {
  try {
    const { slots } = JSON.parse(await readFile(slotsFile(home), "utf8"));
    return slots.filter((slot) => alive(slot.pid));
  } catch {
    return [];
  }
}

async function writeSlots(home, slots) {
  const file = slotsFile(home);
  await writeFile(`${file}.tmp`, JSON.stringify({ slots }, null, 1));
  await rename(`${file}.tmp`, file);
}

/** Gives back job `id`'s threads. */
function releaseSlot(home, pid, id) {
  const others = (slot) => !(slot.pid === pid && slot.id === id);
  return withLock(home, async () => writeSlots(home, (await readSlots(home)).filter(others)));
}

/** Takes `threads` of `budget` for job `id` if they are free now: `{ release() }`, or null. */
export async function takeSlot({ home = slotsHome(), id, threads, budget, runner = "lopin", pid = process.pid }) {
  return withLock(home, async () => {
    const slots = await readSlots(home);
    const used = slots.reduce((sum, slot) => sum + slot.threads, 0);
    if (slots.length > 0 && used + threads > budget) return null;
    await writeSlots(home, [...slots, { pid, runner, id, threads, since: new Date().toISOString() }]);
    return { release: () => releaseSlot(home, pid, id) };
  });
}

/** Waits for the threads (checking every `everyMs`), then takes them; `onWait(slots)` once while it waits. */
export async function waitForSlot({ everyMs = 5_000, onWait = () => {}, ...asked }) {
  let told = false;
  for (;;) {
    const slot = await takeSlot(asked);
    if (slot) return slot;
    if (!told) {
      told = true;
      onWait(await readSlots(asked.home));
    }
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}
