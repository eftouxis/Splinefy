// «Μέρος το χρωστάει άλλος» rows for the movement / recurring forms
import { esc, parseAmount } from '../util.js';
import * as P from '../people.js';

export const shareTxt = (o) => (o.a != null ? String(o.a).replace('.', ',') : o.f === 0.5 ? '½' : o.f != null ? `${Math.round(o.f * 100)}%` : '');
export function othHtml(list) {
  const ps = P.people();
  if (!ps.length) return `<div class="small muted" style="margin:4px 2px 10px">Μέρος το πληρώνει κάποιος τρίτος (αδερφή, φίλοι…): πρόσθεσε πρώτα το άτομο στο Αρχική → Χρωστούμενα.</div>`;
  const rows = (list && list.length ? list : []).map((o, i) => `<div class="grid2" data-othrow="${i}" style="margin-bottom:6px">
      <select name="othp">${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === o.p ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="">— κανείς —</option></select>
      <input name="otha" inputmode="decimal" value="${esc(shareTxt(o))}" placeholder="½ ή ποσό ή %"></div>`).join('');
  return `<label class="f"><span>Ποιος και πόσο</span>${rows}
    <button type="button" class="btn sm" data-othadd>+ Άτομο</button>
    <div class="small muted" style="margin:6px 2px 0">Γράψε ½, 30% ή ποσό. Το κομμάτι τους δεν μετράει στα έξοδά σας — μπαίνει στα Χρωστούμενα ως «μου χρωστάει».</div></label>`;
}
export function readOth(root) {
  const out = [];
  root.querySelectorAll('[data-othrow]').forEach((row) => {
    const p = row.querySelector('[name=othp]').value; const v = row.querySelector('[name=otha]').value.trim();
    if (!p || !v) return;
    if (v === '½' || v === '1/2' || v.toLowerCase() === 'μισό') out.push({ p, f: 0.5 });
    else if (v.endsWith('%')) { const x = parseAmount(v.slice(0, -1)); if (x) out.push({ p, f: x / 100 }); }
    else { const x = parseAmount(v); if (x) out.push({ p, a: x }); }
  });
  return out.length ? out : null;
}
