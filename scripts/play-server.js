import { createServer } from "node:http";
import { appendFile, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { REPLAY_FORMAT } from "../src/replay/core/log.js";
import { isAttempt, summarize } from "../src/replay/stats/puzzle-attempts.js";
import { ATTEMPTS_FILE, readAttempts } from "./lib/domain/puzzle-attempts-file.js";
import { eloTable, statsPage } from "./lib/domain/elo-data.js";
import { isPreset, readPresets, withPreset, writePresets } from "./lib/domain/lab-presets.js";
import { REPLAY_DIRS, isReplayDir, isSafeName, replayFileName, replayHeader } from "./lib/domain/replay-files.js";

/**
 * `npm run play`: the local server of the web game. It serves the page, the
 * shared engine (`src/`) and the rules' fonts, and gives the page a small
 * replay API — the one thing a browser cannot do alone is write a file.
 * Listens on 127.0.0.1 only.
 */
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PORT = Number(process.env.PORT ?? 4742);
// out/: the changelogs and documents of the Versions menu (web/index.html).
const STATIC_PREFIXES = ["web/", "src/", "regles/fonts/", "regles/regles.pdf", "out/"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
};
const MAX_BODY = 2_000_000;

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const dirPath = (dir) => join(ROOT, REPLAY_DIRS[dir]);

async function listDir(dir) {
  await mkdir(dirPath(dir), { recursive: true });
  const names = (await readdir(dirPath(dir))).filter(isSafeName).sort().reverse();
  const headers = await Promise.all(
    names.map(async (name) => {
      try {
        return replayHeader(dir, name, JSON.parse(await readFile(join(dirPath(dir), name), "utf8")));
      } catch {
        return null;
      }
    }),
  );
  return headers.filter(Boolean);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) reject(new Error("trop gros"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function saveReplay(req, res) {
  const log = JSON.parse(await readBody(req));
  if (log.format !== REPLAY_FORMAT || !Array.isArray(log.turns)) return send(res, 400, { error: "journal invalide" });
  const name = replayFileName(log);
  await mkdir(dirPath("recent"), { recursive: true });
  await writeFile(join(dirPath("recent"), name), JSON.stringify(log, null, 1));
  return send(res, 201, { dir: "recent", name, path: `${REPLAY_DIRS.recent}/${name}` });
}

async function keepReplay(res, name) {
  await mkdir(dirPath("kept"), { recursive: true });
  await copyFile(join(dirPath("recent"), name), join(dirPath("kept"), name));
  return send(res, 201, { dir: "kept", name, path: `${REPLAY_DIRS.kept}/${name}` });
}

/** `/api/replays`: the list (GET) or a new log (POST). */
async function collection(req, res) {
  if (req.method === "GET") return send(res, 200, { recent: await listDir("recent"), kept: await listDir("kept") });
  if (req.method === "POST") return saveReplay(req, res);
  return send(res, 405, { error: "méthode non prise en charge" });
}

/** `/api/replays/:dir/:name[/garder]`: one log, or keeping it. */
async function item(req, res, [dir, name, action]) {
  if (!isReplayDir(dir) || !isSafeName(name)) return send(res, 400, { error: "nom de replay invalide" });
  if (req.method === "GET" && !action) return send(res, 200, await readFile(join(dirPath(dir), name)));
  const keeping = req.method === "POST" && action === "garder" && dir === "recent";
  if (keeping) return keepReplay(res, name);
  return send(res, 404, { error: "introuvable" });
}

/** `/api/puzzles/attempts`: one more attempt (POST), or the summary per puzzle (GET). */
async function attempts(req, res) {
  if (req.method === "GET") return send(res, 200, { summary: summarize(await readAttempts()) });
  if (req.method !== "POST") return send(res, 405, { error: "méthode non prise en charge" });
  const attempt = JSON.parse(await readBody(req));
  if (!isAttempt(attempt)) return send(res, 400, { error: "tentative invalide" });
  await appendFile(ATTEMPTS_FILE, `${JSON.stringify(attempt)}\n`);
  return send(res, 201, { stored: true });
}

const LAB_CONFIGS = join(ROOT, "data/lab-configs.json");

/** `/api/lab/configs`: what the duels measured (npm run lab-index), or nothing yet. */
async function labConfigs(res) {
  const text = await readFile(LAB_CONFIGS, "utf8").catch(() => JSON.stringify({ names: {}, pairs: [] }));
  return send(res, 200, text);
}

/** `/api/lab/presets`: the Labo's saved settings (GET), or one more (POST, replacing one of the same name). */
async function labPresets(req, res) {
  if (req.method === "GET") return send(res, 200, { presets: await readPresets() });
  if (req.method !== "POST") return send(res, 405, { error: "méthode non prise en charge" });
  const preset = { ...JSON.parse(await readBody(req)), savedAt: new Date().toISOString() };
  if (!isPreset(preset)) return send(res, 400, { error: "réglage invalide" });
  await writePresets(withPreset(await readPresets(), preset));
  return send(res, 201, { stored: true });
}

const api = (req, res, parts) => (parts.length === 0 ? collection(req, res) : item(req, res, parts));

async function serveStatic(res, path) {
  const relative = path === "/" ? "web/index.html" : decodeURIComponent(path.slice(1));
  const clean = normalize(relative).split(sep).join("/");
  if (clean.includes("..") || !STATIC_PREFIXES.some((prefix) => clean.startsWith(prefix))) {
    return send(res, 404, "introuvable", "text/plain; charset=utf-8");
  }
  const body = await readFile(join(ROOT, clean));
  return send(res, 200, body, TYPES[extname(clean)] ?? "application/octet-stream");
}

/** The API's fixed paths. */
const ROUTES = {
  "/api/elo": async (req, res) => send(res, 200, await eloTable()),
  "/api/stats": async (req, res) => send(res, 200, await statsPage()),
  "/api/lab/configs": (req, res) => labConfigs(res),
  "/api/lab/presets": labPresets,
  "/api/puzzles/attempts": attempts,
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (ROUTES[pathname]) {
      await ROUTES[pathname](req, res);
    } else if (pathname.startsWith("/api/replays")) {
      const parts = pathname.split("/").slice(3).filter(Boolean).map(decodeURIComponent);
      await api(req, res, parts);
    } else {
      await serveStatic(res, pathname);
    }
  } catch (error) {
    send(res, error.code === "ENOENT" ? 404 : 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Lopin — http://127.0.0.1:${PORT}/  (Ctrl+C pour arrêter)\n`);
});
