// Calculator keys under an amount field: 12,50+8 → 20,50 €
import { parseAmount, eur } from '../util.js';

const OPS = [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['=', '=']];
export const calcHtml = () => `<div class="calc" data-calc>${OPS.map(([l, v]) => `<button type="button" data-op="${v}">${l}</button>`).join('')}<span class="calc-res" data-calcres></span></div>`;
const hasOp = (s) => /\d\s*[+\-*/×÷−]\s*[\d(]/.test(s);
const show = (n) => String(n).replace('.', ',');
export function bindCalc(root, input, onChange) {
  const bar = root.querySelector('[data-calc]'); if (!bar || !input) return;
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
