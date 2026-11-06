// «Μέρος το χρωστάει άλλος» rows for the movement / recurring forms
import { esc, parseAmount, eur } from '../util.js';
import * as P from '../people.js';

export const shareTxt = (o) => (o.a != null ? String(o.a).replace('.', ',') : o.f === 0.5 ? '½' : o.f != null ? `${Math.round(o.f * 100)}%` : '');
const INS = ['Άλκης', 'Χαρά'];
/** who of the two of us share it (the rest after the others) */
const insOf = (f) => (f.for === 'Κοινό' ? [...INS] : INS.includes(f.for) ? [f.for] : [f.payer && INS.includes(f.payer) ? f.payer : 'Άλκης']);
const fracTxt = (x) => (Math.abs(x - 0.5) < 1e-6 ? '½' : Math.abs(x - 0.25) < 1e-6 ? '¼' : Math.abs(x - 1 / 3) < 1e-3 ? '⅓' : `${Math.round(x * 100)}%`);
/** one row per person who shares the cost: the others (with their part) and then us (the rest, worked out) */
export function othHtml(f, amt) {
  const ps = P.people(); const list = f.oth || []; const ins = insOf(f);
  const fr = list.reduce((s, o) => s + (o.f || (o.a && amt ? o.a / amt : 0)), 0);
  const rest = Math.max(0, 1 - fr) / ins.length;
  const free = INS.filter((n) => !ins.includes(n));
  const sel = (o) => `<select name="othp" class="grow"><option value="" disabled ${o.p ? '' : 'selected'}>Ποιος;</option>${free.map((n) => `<option value="in:${n}">${n}</option>`).join('')}${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === o.p ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
  const ext = list.map((o, i) => `<div class="row" data-othrow="${i}" style="margin-bottom:6px;gap:6px">${sel(o)}
      <input name="otha" inputmode="decimal" value="${esc(shareTxt(o))}" placeholder="½ / 30% / €" style="width:124px">
      <button type="button" class="btn sm ghost" data-othdel="${i}" title="αφαίρεση">✕</button></div>`).join('');
  const mine = ins.map((n) => `<div class="row" data-inrow="${n}" style="margin-bottom:6px;gap:6px">
      <select class="grow" data-insel="${n}">${INS.filter((x) => x === n || !ins.includes(x)).map((x) => `<option ${x === n ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <input value="${fracTxt(rest)}${amt ? ' · ' + eur(amt * rest) : ''}" disabled style="width:124px;opacity:.75;font-size:15px" title="το υπόλοιπο, βγαίνει μόνο του">
      ${ins.length > 1 ? `<button type="button" class="btn sm ghost" data-indel="${n}" title="αφαίρεση">✕</button>` : '<span style="width:36px"></span>'}</div>`).join('');
  return `${ext}${mine}<button type="button" class="btn sm" data-othadd>+ Άτομο</button>
    <div class="small muted" style="margin:6px 2px 4px">Στους άλλους γράψε ½, 30% ή ποσό· σε εσάς μπαίνει μόνο του ό,τι περισσεύει. Το κομμάτι των άλλων πάει στις Οφειλές («μου χρωστάει»).${ps.length ? '' : ' Άτομα (αδερφή, φίλοι…) προσθέτεις στις <a href="#/debts">Οφειλές</a>.'}</div>`;
}
/** the rows as written (also unfinished ones, so nothing disappears while typing) */
export function rowsOth(root) {
  return [...root.querySelectorAll('[data-othrow]')].map((row) => {
    const p = row.querySelector('[name=othp]').value; const v = row.querySelector('[name=otha]').value.trim();
    const o = parseShare(v); return { p, ...(o || {}), _v: v };
  });
}
const parseShare = (v) => {
  if (!v) return null;
  if (v === '½' || v === '1/2' || v.toLowerCase() === 'μισό') return { f: 0.5 };
  if (v.endsWith('%')) { const x = parseAmount(v.slice(0, -1)); return x ? { f: x / 100 } : null; }
  const x = parseAmount(v); return x ? { a: x } : null;
};
export function readOth(root) {
  const out = rowsOth(root).filter((o) => o.p && (o.f || o.a)).map(({ _v, ...o }) => o);
  return out.length ? out : null;
}
/** «Για ποιον» of an expense — the same in every form: Κοινό ½ / Άλκης / Χαρά / Φίλιππος / + Άλλοι */
export function forHtml(f, seg) {
  return `<label class="f"><span>Για ποιον</span>${seg('forx', [['Κοινό', 'Κοινό ½'], ['Άλκης', 'Άλκης'], ['Χαρά', 'Χαρά'], ['Φίλιππος', 'Φίλιππος'], ['__oth', '+ Άλλοι']], f.withOth ? '__oth' : f.for)}</label>
    ${f.for === 'Φίλιππος' && !f.withOth ? '<div class="small muted" style="margin:-6px 2px 10px">👶 Πληρώνεται από τα λεφτά του Φιλίππου — μειώνει όσα έχει. Αν το πληρώνετε εσείς, διάλεξε Κοινό.</div>' : ''}
    ${f.withOth ? `<div class="note" style="margin:-2px 0 10px"><div class="small" style="font-weight:700;margin-bottom:6px">Μοιράζεται</div>${othHtml(f, parseAmount(f.a))}</div>` : ''}`;
}
/** tap on «Για ποιον» */
export function forPick(f, v, me) {
  if (v === '__oth') { f.withOth = 1; if (!f.oth || !f.oth.length) f.oth = [{ p: '', f: 0.5 }]; if (!['Άλκης', 'Χαρά', 'Κοινό'].includes(f.for)) f.for = me; }
  else { f.withOth = 0; f.oth = null; f.for = v; }
}
const setIns = (f, list) => { f.for = list.length > 1 ? 'Κοινό' : list[0]; };
/** + Άτομο / ✕ / choosing a person in the rows */
export function bindOth(root, f, read, render) {
  root.querySelector('[data-othadd]')?.addEventListener('click', () => { read(); f.oth = [...(f.oth || []), { p: '' }]; render(); });
  root.querySelectorAll('[data-othdel]').forEach((b) => b.addEventListener('click', () => {
    read(); f.oth = (f.oth || []).filter((_, i) => i !== Number(b.dataset.othdel)); if (!f.oth.length) { f.oth = null; f.withOth = 0; } render();
  }));
  root.querySelectorAll('[data-othrow] [name=othp]').forEach((s) => s.addEventListener('change', () => {
    if (!s.value.startsWith('in:')) return;               // one of us: becomes a row of ours
    const i = Number(s.closest('[data-othrow]').dataset.othrow); read();
    f.oth = (f.oth || []).filter((_, j) => j !== i); setIns(f, [...insOf(f), s.value.slice(3)]); render();
  }));
  root.querySelectorAll('[data-indel]').forEach((b) => b.addEventListener('click', () => { read(); setIns(f, insOf(f).filter((n) => n !== b.dataset.indel)); render(); }));
  root.querySelectorAll('[data-insel]').forEach((s) => s.addEventListener('change', () => { read(); setIns(f, insOf(f).map((n) => (n === s.dataset.insel ? s.value : n))); render(); }));
  root.querySelectorAll('[data-othrow] [name=otha]').forEach((i) => i.addEventListener('change', () => { read(); render(); }));
}
