/** Small DOM helpers shared by the page's modules. */
export const $ = (id) => document.getElementById(id);

/** `el("div", { class: "card", dataset: { index: 3 } }, "text", child)`. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "dataset") Object.assign(node.dataset, value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

/**
 * Escape closes a dialog without touching `returnValue`: without this reset,
 * dismissing "Nouvelle partie" would replay the previous answer and start a
 * game nobody asked for.
 */
export function openDialog(dialog) {
  dialog.returnValue = "";
  dialog.showModal();
}

let toastTimer = null;

/** A short message in the corner, gone after a few seconds. */
export function toast(text, ms = 5000) {
  const box = $("toast");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.hidden = true;
  }, ms);
}

/** A seed from the browser's cryptographic generator: every game differs. */
export const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private window or blocked storage: the page works without it.
  }
}

export function recall(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
