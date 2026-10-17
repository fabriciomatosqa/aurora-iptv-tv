const focusables = (root = document) => [...root.querySelectorAll("[data-focus]")].filter(el => el.getClientRects().length && !el.disabled);
export function focusFirst() { const el = focusables()[0]; if (el) el.focus({ preventScroll: true }); }
export function restoreFocus(key) {
  const match = focusables().find(el => el.dataset.focus === key);
  if (match) { match.focus({ preventScroll: true }); match.scrollIntoView({ block: "nearest", inline: "nearest" }); return; }
  focusFirst();
}
export function nextFocus(direction, root = document) {
  const current = document.activeElement;
  const origin = current?.getBoundingClientRect();
  if (!origin) return focusFirst();
  const x = origin.left + origin.width / 2, y = origin.top + origin.height / 2;
  const vertical = direction === "ArrowUp" || direction === "ArrowDown";
  const sign = direction === "ArrowRight" || direction === "ArrowDown" ? 1 : -1;
  const choices = focusables(root).filter(el => el !== current).map(el => {
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
    const primary = vertical ? dy : dx, secondary = vertical ? dx : dy;
    return { el, primary, secondary, score: Math.abs(primary) + Math.abs(secondary) * 2.3 };
  }).filter(c => c.primary * sign > 4).sort((a, b) => a.score - b.score);
  if (choices.length) {
    const el = choices[0].el;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
}
