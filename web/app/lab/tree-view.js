import { keyName, percent } from "./lab-text.js";
import { bandLabel, layoutTree, rateHue } from "./tree-layout.js";

/**
 * The Labo's tree, drawn in SVG (Sami, 17/10: navigable, as a map): the wheel zooms around the pointer, a drag moves,
 * a double click on the background fits the whole tree, Escape too. A click on a node selects it (`onSelect(id)`), a
 * double click unfolds or folds it; a click on a ply's band names it (`onBand(depth)`). Where things go is
 * tree-layout.js (pure); this module only draws and listens, and keeps the view of the decision on show.
 */
const SVG = "http://www.w3.org/2000/svg";
const DRAG_PX = 4;
const MIN_SCALE = 0.05;

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== undefined) node.setAttribute(key, value);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

const fill = (rate) => {
  const hue = rateHue(rate);
  return hue === null ? "var(--stone)" : `hsl(${hue} 62% 44%)`;
};

/** The ids on the line of the move played: the root child played and nothing below (its replies are the opponent's choice). */
const playedId = (played) => (played ? `${played.card}@${played.border}` : null);

/** `ctx`: `{ view, svg, container, onSelect, onBand }`, one per drawing. */
function applyBox({ view, svg: root }) {
  const { x, y, w, h } = view.box;
  root.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
}

/** The whole tree in the frame, centred, never larger than 1:1. */
function fit(ctx) {
  const { width, height } = ctx.view.layout;
  const rect = ctx.container.getBoundingClientRect();
  const aspect = rect.height > 0 ? rect.width / rect.height : 2;
  const w = Math.max(width, height * aspect, rect.width || width);
  const h = w / aspect;
  ctx.view.box = { x: (width - w) / 2, y: (height - h) / 2, w, h };
  applyBox(ctx);
}

function nodeClasses(view, node) {
  return ["tree-node", node.id === view.selected ? "selected" : "", node.id === playedId(view.played) ? "played" : "", node.hidden ? "ghost" : ""].filter(Boolean).join(" ");
}

const nodeName = (view, node) => (node.hidden ? `+${node.hidden}` : keyName(view.spec, node.key));

/** The candidates, the large replies and the « +n » nodes are named under them; the others on hover. */
function nodeLabel(view, node) {
  const named = node.depth === 1 || (node.depth === 2 && node.r >= 7) || node.hidden > 0;
  return named ? svg("text", { x: node.x, y: node.y + node.r + 11, class: "tree-label" }, nodeName(view, node)) : null;
}

function nodeShape(view, node) {
  const title = node.hidden ? `${node.hidden} autres coups, ${node.visits} visites` : `${keyName(view.spec, node.key)} · ${node.visits} visites · ${percent(node.rate)}`;
  const folded = node.folded > 0 ? svg("text", { x: node.x + node.r + 3, y: node.y + 4, class: "tree-folded" }, `▸${node.folded}`) : null;
  const colour = node.depth === 0 ? "var(--felt)" : fill(node.rate);
  return svg("g", { class: nodeClasses(view, node), "data-id": node.id }, svg("circle", { cx: node.x, cy: node.y, r: node.r, fill: colour }, svg("title", {}, title)), nodeLabel(view, node), folded);
}

function bandRow(band, width) {
  return svg("g", { class: "tree-band", "data-band": band.depth }, svg("rect", { x: -4000, y: band.y - 46, width: width + 8000, height: 92 }), svg("text", { x: 6, y: band.y - 30, class: "tree-band-label" }, bandLabel(band.depth)));
}

function linkPath(view, at, { from, to, width }) {
  const [a, b] = [at.get(from), at.get(to)];
  const middle = (a.y + b.y) / 2;
  return svg("path", { d: `M${a.x},${a.y + a.r} C${a.x},${middle} ${b.x},${middle} ${b.x},${b.y - b.r}`, "stroke-width": width, class: to === playedId(view.played) ? "tree-link played" : "tree-link" });
}

function draw(ctx) {
  const { view } = ctx;
  view.layout = layoutTree(view.snapshot, { expanded: view.expanded });
  const { nodes, links, bands, width } = view.layout;
  const at = new Map(nodes.map((node) => [node.id, node]));
  const layers = [bands.map((band) => bandRow(band, width)), links.map((link) => linkPath(view, at, link)), nodes.map((node) => nodeShape(view, node))];
  ctx.svg.replaceChildren(...["tree-bands", "tree-links", "tree-nodes"].map((name, index) => svg("g", { class: name }, ...layers[index])));
  if (view.box) applyBox(ctx);
  else fit(ctx);
}

/** The wheel zooms around the pointer, down to `MIN_SCALE` of the tree's width. */
function wireZoom(ctx) {
  const { view, svg: root } = ctx;
  const onWheel = (event) => {
    if (!view.box) return;
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    const { x, y, w, h } = view.box;
    const point = { x: x + ((event.clientX - rect.left) / rect.width) * w, y: y + ((event.clientY - rect.top) / rect.height) * h };
    const nw = Math.max(w * Math.exp(event.deltaY * 0.0015), view.layout.width * MIN_SCALE);
    const scale = nw / w;
    view.box = { x: point.x - (point.x - x) * scale, y: point.y - (point.y - y) * scale, w: nw, h: h * scale };
    applyBox(ctx);
  };
  root.addEventListener("wheel", onWheel, { passive: false });
}

/**
 * A click that did not move picks a node (selected, then `onSelect`) or a ply's band (`onBand`). `target`: what the
 * press began on — the pointer is captured by the SVG, so the release's own target is the SVG.
 */
function picked(ctx, target) {
  const node = target.closest?.("[data-id]");
  if (node) {
    ctx.view.selected = node.dataset.id;
    draw(ctx);
    ctx.onSelect(node.dataset.id);
    return;
  }
  const band = target.closest?.("[data-band]");
  if (band) ctx.onBand(Number(band.dataset.band));
}

/** A drag moves the view; a press that does not move is a click. */
function wireDrag(ctx) {
  const { view, svg: root } = ctx;
  let drag = null;
  root.addEventListener("pointerdown", (event) => {
    if (!view.box) return;
    drag = { startX: event.clientX, startY: event.clientY, box: { ...view.box }, moved: false, target: event.target };
    root.setPointerCapture(event.pointerId);
  });
  root.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const [dx, dy] = [event.clientX - drag.startX, event.clientY - drag.startY];
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    drag.moved = true;
    root.classList.add("dragging");
    const scale = drag.box.w / root.getBoundingClientRect().width;
    view.box = { ...drag.box, x: drag.box.x - dx * scale, y: drag.box.y - dy * scale };
    applyBox(ctx);
  });
  root.addEventListener("pointerup", () => {
    const press = drag;
    drag = null;
    root.classList.remove("dragging");
    if (press && !press.moved) picked(ctx, press.target);
  });
}

/** A double click unfolds or folds a node, or fits the tree from the background; Escape fits it too. */
function wireFolds(ctx) {
  const { view } = ctx;
  ctx.svg.addEventListener("dblclick", (event) => {
    const id = event.target.closest?.("[data-id]")?.dataset.id;
    if (id === undefined) return fit(ctx);
    if (view.expanded.has(id)) view.expanded.delete(id);
    else view.expanded.add(id);
    return draw(ctx);
  });
  ctx.container.tabIndex = 0;
  ctx.container.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && view.box) fit(ctx);
  });
}

/**
 * `state`: an object the caller keeps between redraws (the panel is redrawn on every change), so the zoom, the folds
 * and the selection survive them.
 */
export function createTreeView(container, { state = {}, onSelect = () => {}, onBand = () => {} } = {}) {
  const view = Object.assign(state, { key: null, expanded: new Set(), selected: null, box: null, ...state, snapshot: null, layout: null });
  const ctx = { view, container, onSelect, onBand, svg: svg("svg", { class: "tree-svg", role: "img", "aria-label": "Arbre de recherche" }) };
  container.replaceChildren(ctx.svg);
  wireZoom(ctx);
  wireDrag(ctx);
  wireFolds(ctx);
  return {
    /** Draws `snapshot`; a new `key` (another decision) starts folded, unselected and fitted. */
    show(snapshot, { key, spec, names, played }) {
      if (key !== view.key) Object.assign(view, { key, expanded: new Set(), selected: null, box: null });
      Object.assign(view, { snapshot, spec, names, played });
      draw(ctx);
    },
    selected: () => view.selected,
    fit: () => view.layout && fit(ctx),
  };
}
