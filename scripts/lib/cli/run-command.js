import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Stops `child` and everything it started (on Windows the shell's children outlive it otherwise). */
export function stopTree(child) {
  if (process.platform === "win32") spawn(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/pid", String(child.pid), "/T", "/F"]);
  else child.kill("SIGTERM");
}

/**
 * Runs `command` in a shell from the project's root, its output both on screen (unless `quiet`) and in
 * `outFile`; resolves with the exit code, or "timeout" once `minutes` have passed (the whole process
 * tree is stopped). `env` is added to the inherited environment (a job's own `LOPIN_THREADS`).
 */
export function runCommand(command, { outFile, minutes = Infinity, env = {}, quiet = false }) {
  const out = createWriteStream(outFile);
  return new Promise((resolve) => {
    const child = spawn(command, { cwd: ROOT, shell: true, env: { ...process.env, ...env } });
    let timedOut = false;
    const timer = Number.isFinite(minutes)
      ? setTimeout(() => {
          timedOut = true;
          out.write(`\n[backlog] arrêté au bout de ${minutes} min\n`);
          stopTree(child);
        }, minutes * 60_000)
      : null;
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        if (!quiet) process.stdout.write(chunk);
        out.write(chunk);
      });
    }
    child.on("close", (code) => {
      clearTimeout(timer);
      out.end(() => resolve(timedOut ? "timeout" : code));
    });
  });
}
