// #/bills — Λογαριασμοί σπιτιού: ανά είδος (ρεύμα, νερό, κοινόχρηστα…), ανά χρονιά ή δικό σου διάστημα, με καταναλώσεις
import { esc, eur, today, dFull, MSHORT, addMonths } from '../util.js';
import * as ST from '../stats.js';
import { bars } from './stats.js';

const UNIT = { 'Ρεύμα': 'kWh', 'Νερό': 'm³', 'Θέρμανση': 'μον.', 'Κοινόχρηστα': 'μον.', 'Φυσικό αέριο': 'kWh', 'Αέριο': 'kWh' };
const IC = { 'Ρεύμα': '⚡', 'Νερό': '💧', 'Θέρμανση': '🔥', 'Φυσικό αέριο': '🔥', 'Αέριο': '🔥', 'Κοινόχρηστα': '🏢', 'Τηλέφωνο': '📞', 'Internet': '🌐', 'Ίντερνετ': '🌐', 'Κινητό': '📱', 'Ασφάλεια': '🛡️', 'Ασφάλειες': '🛡️', 'Ενοίκιο': '🏠', 'ΕΝΦΙΑ': '🏛️', 'Δήμος': '🏛️', 'Συνδρομές': '📺' };
const ic = (k) => IC[k] || Object.entries(IC).find(([n]) => k.toLowerCase().includes(n.toLowerCase()))?.[1] || '📄';
const num = (x, d = 0) => x.toLocaleString('el-GR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtD = (s) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const minusYear = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`.replace(/-02-29$/, '-02-28');

let rg = (() => { try { return JSON.parse(localStorage.getItem('bills-rg')) || { k: '12m' }; } catch { return { k: '12m' }; } })();
const RG = [['12m', '12 μήνες'], ['y', 'Φέτος'], ['py', 'Πέρσι'], ['all', 'Όλα'], ['c', 'Από–έως']];
function rangeOf() {
  const t = today(); const Y = Number(t.slice(0, 4));
  if (rg.k === '12m') return [addMonths(`${t.slice(0, 7)}-01`, -11), t];
  if (rg.k === 'y') return [`${Y}-01-01`, t];
  if (rg.k === 'py') return [`${Y - 1}-01-01`, `${Y - 1}-12-31`];
  if (rg.k === 'all') return ['2000-01-01', t];
  return [rg.from || `${Y}-01-01`, rg.to || t];
}
// Κοινόχρηστα: η κατανάλωση είναι μονάδες θέρμανσης, οπότε €/μονάδα = κατανάλωση θέρμανσης € / μονάδες
const sum = (l) => { const a = l.reduce((s, b) => s + b.a, 0); const wc = l.filter((b) => b.cons > 0); const c = wc.reduce((s, b) => s + b.cons, 0);
  const wh = wc.filter((b) => b.heat > 0); const h = l.reduce((s, b) => s + (b.heat || 0), 0), f = l.reduce((s, b) => s + (b.fix || 0), 0);
  const per = wh.length ? wh.reduce((s, b) => s + b.heat, 0) / wh.reduce((s, b) => s + b.cons, 0) : c ? wc.reduce((s, b) => s + b.a, 0) / c : 0;
  return { a, c, per, n: l.length, h, f }; };
const inR = (b, f, t) => b.d >= f && b.d <= t;
function rangeBar(f, t) {
  return `<div class="chips" style="margin-bottom:6px">${RG.map(([k, l]) => `<button class="chip ${rg.k === k ? 'on' : ''}" data-rg="${k}">${l}</button>`).join('')}</div>
    ${rg.k === 'c' ? `<div class="row" style="gap:6px;margin-bottom:8px"><input type="date" data-rgf value="${esc(f)}" style="flex:1"><span class="small muted">έως</span><input type="date" data-rgt value="${esc(t)}" style="flex:1"></div>`
    : rg.k === 'all' ? '' : `<div class="small muted" style="margin:0 4px 8px">${fmtD(f)} – ${fmtD(t)}</div>`}`;
}
const consTxt = (s, k) => (s.c && UNIT[k] ? `${num(s.c)} ${UNIT[k]} · ${num(s.per, 3)} €/${UNIT[k]}` : '');

function home() {
  const B = ST.cube().bills; const [f, t] = rangeOf(); const pf = minusYear(f), pt = minusYear(t);
  const kinds = [...new Set(B.map((b) => b.kind))].map((k) => ({ k, s: sum(B.filter((b) => b.kind === k && inR(b, f, t))), p: sum(B.filter((b) => b.kind === k && inR(b, pf, pt))) }))
    .filter((x) => x.s.n || rg.k !== 'all').sort((a, b) => b.s.a - a.s.a);
  const tot = kinds.reduce((s, x) => s + x.s.a, 0), ptot = kinds.reduce((s, x) => s + x.p.a, 0);
  return `<div class="top"><h1>Λογαριασμοί</h1></div>
  ${rangeBar(f, t)}
  <div class="card kpi"><div class="label">Σύνολο λογαριασμών</div><div class="mid">${eur(tot)}</div>${rg.k !== 'all' && ptot ? `<div class="small muted">ίδιο διάστημα πριν ένα χρόνο ${eur(ptot)}</div>` : ''}</div>
  <div class="list">${kinds.map(({ k, s, p }) => `<div class="item click" data-kind="${esc(k)}"><div class="dot">${ic(k)}</div>
    <div class="grow"><div class="t">${esc(k)} <span class="cnt">${s.n}</span></div><div class="s">${consTxt(s, k) || (s.n ? `μ.ο. ${eur(s.a / s.n)} ο λογαριασμός` : 'κανένας σε αυτό το διάστημα')}</div></div>
    <div style="text-align:right"><div class="amt">${eur(s.a)}</div>${rg.k !== 'all' && p.a ? `<div class="small ${s.a > p.a ? 'neg' : 'pos'}">${s.a > p.a ? '▲' : '▼'} ${Math.round(Math.abs(s.a - p.a) / p.a * 100)}%</div>` : ''}</div></div>`).join('') || '<div class="item muted">Κανένας λογαριασμός ακόμα</div>'}</div>`;
}

function kind(k) {
  const all = ST.cube().bills.filter((b) => b.kind === k).sort((a, b) => (a.d < b.d ? 1 : -1));
  const [f, t] = rangeOf(); const l = all.filter((b) => inR(b, f, t)); const s = sum(l), p = sum(all.filter((b) => inR(b, minusYear(f), minusYear(t))));
  const yrs = [...new Set(all.map((b) => b.d.slice(0, 4)))].sort().reverse().map((y) => ({ y, ...sum(all.filter((b) => b.d.startsWith(y))) }));
  const u = UNIT[k]; const chartL = l.slice(0, 24).reverse();
  const hasCons = all.some((b) => b.cons > 0); const hasHeat = all.some((b) => b.heat > 0 || b.fix > 0);
  return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1 class="grow">${ic(k)} ${esc(k)}</h1><a class="btn sm" href="#/add/exp?desc=${encodeURIComponent(all[0]?.desc || k)}">+ Νέος</a></div>
  ${rangeBar(f, t)}
  <div class="grid${hasCons && u ? '3' : '2'}"><div class="card kpi"><div class="label">Σύνολο</div><div class="mid">${eur(s.a)}</div><div class="small muted">${s.n} λογαριασμοί</div></div>
    ${hasCons && u ? `<div class="card kpi"><div class="label">Κατανάλωση</div><div class="mid">${num(s.c)} ${u}</div><div class="small muted">${s.c ? num(s.per, 3) + ' €/' + u : '—'}</div></div>` : ''}
    ${s.h || s.f ? `<div class="card kpi"><div class="label">🔥 Θέρμανση</div><div class="mid">${eur(s.h + s.f)}</div><div class="small muted">κατανάλωση ${eur(s.h)} · πάγιο ${eur(s.f)}</div></div>` : ''}
    ${rg.k === 'all' ? '' : `<div class="card kpi"><div class="label">Πριν ένα χρόνο</div><div class="mid">${eur(p.a)}</div>${p.a ? `<div class="small ${s.a > p.a ? 'neg' : 'pos'}">${s.a > p.a ? '▲' : '▼'} ${Math.round(Math.abs(s.a - p.a) / p.a * 100)}%${hasCons && u && p.c ? ` · ${num(p.c)} ${u}` : ''}</div>` : ''}</div>`}</div>
  ${chartL.length > 1 ? `<div class="card">${bars(chartL.map((b) => `${MSHORT[Number(b.d.slice(5, 7)) - 1]} ${b.d.slice(2, 4)}`), [{ name: '€', cls: 's-exp', values: chartL.map((b) => b.a) }], chartL.map((b) => `e:${b.sp}/${b.id}`), 140)}
    ${hasCons && u ? `<div class="small muted" style="margin-top:6px">Κατανάλωση (${u})</div>${bars(chartL.map((b) => `${MSHORT[Number(b.d.slice(5, 7)) - 1]} ${b.d.slice(2, 4)}`), [{ name: u, cls: 's-inc', values: chartL.map((b) => b.cons || 0) }], chartL.map((b) => `e:${b.sp}/${b.id}`), 120)}` : ''}</div>` : ''}
  <h2>Ανά χρονιά</h2>
  <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Έτος</th><th class="r">€</th>${hasCons && u ? `<th class="r">${u}</th><th class="r">€/${u}</th>` : ''}${hasHeat ? '<th class="r">🔥 €</th>' : ''}<th class="r">Λογ.</th></tr>
    ${yrs.map((r) => `<tr class="click" data-y="${r.y}"><td><b>${r.y}</b></td><td class="r">${eur(r.a)}</td>${hasCons && u ? `<td class="r">${r.c ? num(r.c) : ''}</td><td class="r">${r.c ? num(r.per, 3) : ''}</td>` : ''}${hasHeat ? `<td class="r">${r.h + r.f ? eur(r.h + r.f) : ''}</td>` : ''}<td class="r">${r.n}</td></tr>`).join('')}</table></div>
  <h2>Λογαριασμοί</h2>
  <div class="list">${l.map((b) => `<div class="item click" data-edit="${esc(b.sp)}/${esc(b.id)}"><div class="grow"><div class="t">${dFull(b.d)}${b.period ? ` <span class="small muted">· ${esc(b.period)}</span>` : ''}</div>
    <div class="s">${esc(b.desc)}${b.cons ? ` · ${num(b.cons, 2).replace(/,00$/, '')} ${u || ''}` : ''}${b.heat || b.fix ? ` · 🔥 ${eur((b.heat || 0) + (b.fix || 0))}` : ''}</div></div><div class="amt">${eur(b.a)}</div></div>`).join('') || '<div class="item muted">Κανένας σε αυτό το διάστημα</div>'}</div>`;
}

export default {
  live: true,
  html([k]) { return k ? kind(decodeURIComponent(k)) : home(); },
  mount(root, [k], ui) {
    const save = () => { try { localStorage.setItem('bills-rg', JSON.stringify(rg)); } catch { /* */ } ui.render(); };
    root.querySelectorAll('[data-rg]').forEach((b) => b.addEventListener('click', () => { const [f, t] = rangeOf(); rg = b.dataset.rg === 'c' ? { k: 'c', from: f < '2001' ? `${today().slice(0, 4)}-01-01` : f, to: t } : { k: b.dataset.rg }; save(); }));
    root.querySelector('[data-rgf]')?.addEventListener('change', (e) => { rg.from = e.target.value; save(); });
    root.querySelector('[data-rgt]')?.addEventListener('change', (e) => { rg.to = e.target.value; save(); });
    root.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => ui.go(`#/bills/${encodeURIComponent(b.dataset.kind)}`)));
    root.querySelectorAll('tr[data-y]').forEach((b) => b.addEventListener('click', () => { const y = b.dataset.y; rg = { k: 'c', from: `${y}-01-01`, to: `${y}-12-31` }; save(); }));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => ui.go(`#/edit/${b.dataset.edit}`)));
    root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.k; if (v.startsWith('e:')) ui.go(`#/edit/${v.slice(2)}`); }));
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.go('#/bills'));
  },
};
