import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { BOT_LINEUP } from "../src/config/bots.js";

/**
 * `npm run changelog -- [1.0 | oracle]`: the changelog of a version of the
 * Experimental, out/changelog-exp-<version>.html, or the oracles' (out/changelog-oracle.html) (and its copy without the
 * skeleton in out/artifact/) — every attempt that led to it, the night jobs,
 * the speed passes, the oracle, with real positions to play through. One per
 * version (Sami, 03/10); the version defaults to the line-up's.
 *
 * Shared style (`src/report/changelog/style.css`) and V1+ sections
 * (`src/report/changelog/v1-sections.html`) are inlined at build time so each
 * generated file in `out/` remains 100% self-contained over `file://`, while
 * only the datasets actually used by the page are embedded in `DATA`.
 */
const ROOT = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, ROOT), "utf8");
const read = async (path) => JSON.parse(await readText(path));
const MIN_JOKERS = 60;
const ARBRE_NOTE_1_3 = '<p>Le schéma est celui du V1 (le 1.0). Depuis : <strong>7 réponses</strong> par étage au lieu de 3 (le 1.1), et la fin calculée exactement jusqu\'à 12 cartes (le 1.2). Les essais du 11/10 touchent deux étapes : <strong>PUCT</strong> (<code>+puct</code>) change « La descente », le cœur y donne une avance à ses meilleurs coups ; <strong>Ensemble</strong> (<code>+trees=2</code>) change « Le coup joué », deux arbres additionnent leurs visites.</p>';

function commits(since, until) {
  // git is a developer tool found on PATH, like npm that runs this script.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const log = execFileSync("git", ["log", `--since=${since}`, ...(until ? [`--until=${until}`] : []), "--reverse", "--format=%ad|%h|%s", "--date=format:%Y-%m-%dT%H:%M"], { cwd: new URL(".", ROOT), encoding: "utf8" });
  return log.trim().split("\n").filter(Boolean).map((line) => {
    const [at, hash, ...subject] = line.split("|");
    return { at, hash, subject: subject.join("|") };
  });
}

const jobsOf = (file) => (file.jobs ?? file).map(({ id, status, doneAt, minutes, estimate, notBefore }) => ({ id, status, doneAt, minutes, estimate, notBefore }));

/** Where a joker went, one trait at a time (not crossed), on enough jokers to read. */
const placements = (mining) => mining.stats.filter((row) => row.count >= MIN_JOKERS && !row.key.includes("·")).map(({ key, count, game, border }) => ({ key, count, game, border }));

function puzzleKinds(puzzles) {
  const kinds = {};
  for (const puzzle of puzzles) kinds[puzzle.kind ?? "endgame"] = (kinds[puzzle.kind ?? "endgame"] ?? 0) + 1;
  return kinds;
}

async function expandTemplate(version) {
  const [raw, style, v1Sections] = await Promise.all([
    readText(`src/report/changelog/${version}.html`),
    readText("src/report/changelog/style.css"),
    readText("src/report/changelog/v1-sections.html"),
  ]);
  const note = version === "1.3" ? ARBRE_NOTE_1_3 : "";
  return raw
    .replace("/*__STYLE__*/", () => style.trim())
    .replace("<!--__V1_SECTIONS__-->", () => v1Sections.replace("<!--__ARBRE_NOTE__-->", note));
}

async function loadV1ZeroData() {
  return {
    impact: await read("data/error-impact.json"),
    oracle: await read("data/oracle-diffs.json"),
    jokers: placements(await read("data/jokers-mining.json")),
    weakWins: await read("data/weak-wins.json"),
    timings: await read("data/core-timings.json"),
    puzzles: puzzleKinds((await read("web/data/puzzles.json")).puzzles),
    disagree: await read("data/oracle-disagree.json").catch(() => null),
  };
}

async function loadV1PlusData() {
  return {
    bench: await read("data/oracle-bench.json").catch(() => null),
    features: await read("data/core-features.json").catch(() => null),
    versus: await read("data/versus.json").then((file) => file.duels.oracle ?? null, () => null),
    shadow: await read("data/oracle-shadow.json").then((file) => Object.values(file.reads)[0] ?? null, () => null),
    v1ref: await read("data/oracle-diffs-v1ref.json").then(({ positions, gaps, traits }) => ({ positions, gaps, traits }), () => null),
    banc: await Promise.all([read("data/oracle-diffs-banc.json"), read("data/banc.json")]).then(([{ positions, byTurn, ms }, { calibration }]) => ({ positions, byTurn, ms, calibration: calibration ?? null }), () => null),
  };
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const version = process.argv[2] ?? BOT_LINEUP.experimental.version;
const name = version === "oracle" ? "changelog-oracle" : `changelog-exp-${version}`;
const [journal, template, doneFile, queueFile] = await Promise.all([
  read(`data/${name}.json`),
  expandTemplate(version),
  read("data/backlog-done.json"),
  read("data/backlog.json"),
]);
const sinceIso = journal.since.replace(" ", "T");
const allJobs = [...jobsOf(doneFile), ...jobsOf(queueFile), ...(journal.manualJobs ?? []).map((job) => ({ ...job, status: "done", manual: true }))];
const jobs = version === "1.0" ? allJobs : allJobs.filter((j) => !j.doneAt || j.doneAt >= sinceIso || j.manual);
async function loadExtraData(targetVersion, html) {
  if (targetVersion === "1.0") return loadV1ZeroData();
  if (html.includes('id="reference"')) return loadV1PlusData();
  return {};
}

const extra = await loadExtraData(version, template);
const data = {
  version,
  built: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
  builtAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
  journal,
  commits: commits(journal.since, journal.until),
  jobs,
  ...extra,
};

const page = template.replaceAll("__VERSION__", version).replace("/*__DATA__*/null", () => JSON.stringify(data).replaceAll("</", "<\\/"));
await writeFile(new URL(`out/artifact/${name}.html`, ROOT), page);
const cut = page.indexOf('<header class="band">');
const head = '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
await writeFile(new URL(`out/${name}.html`, ROOT), `${head}${page.slice(0, cut)}</head>\n<body>\n${page.slice(cut)}</body>\n</html>\n`);
const measured = journal.attempts.filter((attempt) => attempt.score !== null).length;
const title = version === "oracle" ? "Changelog Oracle" : `Changelog Exp v${version}`;
console.log(`${title} : ${measured} essais mesurés, ${data.commits.length} commits, ${data.jobs.length} jobs → out/${name}.html`);
