import { $ } from "./dom.js";

/**
 * The « 4 couleurs » toggle (Sami, 14/10): ♠ black, ♥ red, ♦ blue, ♣ green
 * instead of red and black, so that a ♦ never passes for a ♥ in a run. Only an
 * attribute on <html> (`data-colors="4"`) that the stylesheet reads, on every
 * tab; remembered in this browser.
 */
const KEY = "lopin.deckColors";

function apply(four) {
  if (four) document.documentElement.dataset.colors = "4";
  else delete document.documentElement.dataset.colors;
  $("btn-colors").setAttribute("aria-pressed", String(four));
}

export function wireDeckColors() {
  let four = false;
  try {
    four = localStorage.getItem(KEY) === "4";
  } catch {
    // Storage blocked: two colours, for this visit.
  }
  apply(four);
  $("btn-colors").addEventListener("click", () => {
    four = !four;
    try {
      localStorage.setItem(KEY, four ? "4" : "2");
    } catch {
      // Storage blocked: the choice holds for this visit only.
    }
    apply(four);
  });
}
