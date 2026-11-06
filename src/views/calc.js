// Calculator keys under an amount field: 12,50+8 → 20,50 €
import { parseAmount, eur } from '../util.js';

const OPS = [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['=', '=']];
export const calcHtml = () => `<div class="calc" data-calc>${OPS.map(([l, v]) => `<button type="button" data-op="${v}">${l}</button>`).join('')}<span class="calc-res" data-calcres></span></div>`;
const hasOp = (s) => /\d\s*[+\-*/×÷−]\s*[\d(]/.test(s);
const show = (n) => String(n).replace('.', ',');
export function bindCalc(root, input, onChange) {
  const bar = root.querySelector('[data-calc]'); if (!bar || !input) return; input._calc = bar;
  const res = bar.querySelector('[data-calcres]');
  const upd = () => { const v = input.value; const x = hasOp(v) ? parseAmount(v) : null; res.textContent = x != null ? `= ${eur(x)}` : ''; };
  const settle = () => { if (hasOp(input.value)) { const x = parseAmount(input.value); if (x != null) { input.value = show(x); upd(); onChange?.(); } } };
  bar.addEventListener('pointerdown', (e) => { if (e.target.dataset.op) e.preventDefault(); });   // keep the keyboard open
  bar.addEventListener('click', (e) => {
    const op = e.target.dataset.op; if (!op) return;
    if (op === '=') { settle(); input.focus(); return; }
    const sym = { '*': '×', '/': '÷', '-': '−' }[op] || op;
    input.value = input.value.replace(/[+\-*/×÷−]\s*$/, '') + sym; input.focus();
    const n = input.value.length; try { input.setSelectionRange(n, n); } catch (_) { /* number inputs */ }
    upd();
  });
  input.addEventListener('input', upd);
  input.addEventListener('blur', settle);
  upd();
}

/** every other money field (inputmode=decimal) gets the same keys while it has focus */
export function autoCalc() {
  document.addEventListener('focusin', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.inputMode !== 'decimal' || input.dataset.nocalc != null) return;
    if (input._calc) return;
    const wrap = document.createElement('div'); wrap.innerHTML = calcHtml(); const bar = wrap.firstElementChild; bar.dataset.auto = '1'; bar.style.marginTop = '6px';
    input.insertAdjacentElement('afterend', bar); input._calc = bar;
    const res = bar.querySelector('[data-calcres]');
    const upd = () => { const v = input.value; const x = hasOp(v) ? parseAmount(v) : null; res.textContent = x != null ? `= ${eur(x)}` : ''; };
    const settle = () => { if (hasOp(input.value)) { const x = parseAmount(input.value); if (x != null) { input.value = show(x); input.dispatchEvent(new Event('input', { bubbles: true })); } } };
    bar.addEventListener('pointerdown', (ev) => ev.preventDefault());
    bar.addEventListener('click', (ev) => {
      const op = ev.target.dataset.op; if (!op) return; ev.preventDefault(); ev.stopPropagation();
      if (op === '=') { settle(); upd(); input.focus(); return; }
      const sym = { '*': '×', '/': '÷', '-': '−' }[op] || op;
      input.value = input.value.replace(/[+\-*/×÷−]\s*$/, '') + sym; input.focus(); upd();
    });
    input.addEventListener('input', upd);
    input.addEventListener('blur', () => { settle(); setTimeout(() => { if (document.activeElement !== input) { bar.remove(); input._calc = null; input.removeEventListener('input', upd); } }, 150); }, { once: true });
    upd();
  });
}
