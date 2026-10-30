// #/stats — statistics: months, years, categories, trips, bills
import { esc, eur, today, MONTHS, MSHORT, addMonths, dFull, norm } from '../util.js';
import { state, records } from '../store.js';
import { movements, fx, VIEWS } from '../ledger.js';
import * as ST from '../stats.js';
import { ICON } from './common.js';
import * as T from '../trips.js';
import { balancesHtml, balancesMount } from './balances.js';
import { carsList } from './cars.js';

let view = null, tab = 'months', selY = null, selCat = null;
const TABS = [['months', 'Μήνες'], ['years', 'Χρόνια'], ['cats', 'Κατηγορίες'], ['trips', 'Ταξίδια'], ['bills', 'Λογαριασμοί'], ['inv', 'Επενδύσεις'], ['bal', 'Ισολογισμός'], ['cars', 'Αυτοκίνητα']];
const short = (m) => `${MSHORT[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;
const k0 = (x) => eur(x).replace(' €', '');

/** grouped bars: series = [{name, cls, values}] ; labels = x labels ; onclick keys */
function bars(labels, series, keys = [], h = 170) {
  const W = 680, pad = 26, n = labels.length, gw = (W - pad) / n, bw = Math.max(3, Math.min(18, (gw - 6) / series.length - 2));
  const raw = Math.max(1, ...series.flatMap((s) => s.values.map((v) => Math.abs(v || 0))));
  const p10 = 10 ** Math.floor(Math.log10(raw)); const max = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((m) => m >= raw);
  const y = (v) => h - 22 - (Math.abs(v || 0) / max) * (h - 34);
  const ticks = [0, 0.5, 1].map((p) => max * p);
  let g = ticks.map((tv) => `<line x1="${pad}" x2="${W}" y1="${y(tv)}" y2="${y(tv)}" class="grid"/><text x="${pad - 4}" y="${y(tv) + 4}" class="ax" text-anchor="end">${tv >= 1000 ? String(Math.round(tv / 100) / 10).replace('.', ',') + 'k' : Math.round(tv)}</text>`).join('');
  labels.forEach((lb, i) => {
    const x0 = pad + i * gw + (gw - series.length * (bw + 2)) / 2;
    series.forEach((s, j) => {
      const v = s.values[i] || 0; const yy = y(v), hh = Math.max(0, h - 22 - yy);
      if (hh > 0) g += `<path d="M${x0 + j * (bw + 2)},${h - 22} v${-hh + 3} q0,-3 3,-3 h${bw - 6} q3,0 3,3 v${hh - 3} z" class="${s.cls}"/>`;
    });
    g += `<rect x="${pad + i * gw}" y="0" width="${gw}" height="${h}" class="hit" ${keys[i] ? `data-k="${esc(keys[i])}"` : ''}><title>${esc(lb)}: ${series.map((s) => `${s.name} ${eur(s.values[i] || 0)}`).join(' · ')}</title></rect>`;
    if (n <= 13 || i % Math.ceil(n / 12) === 0) g += `<text x="${pad + i * gw + gw / 2}" y="${h - 6}" class="ax" text-anchor="middle">${esc(lb)}</text>`;
  });
  const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<svg viewBox="0 0 ${W} ${h}" class="chart" role="img">${g}</svg>`;
}
/** horizontal category bars with optional comparison */
function catBars(entries, cmp = null, cmpLabel = '') {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return entries.map(([c, v]) => {
    const p = cmp?.get(c) || 0; const dl = v - p;
    return `<div class="cbar" data-cat="${esc(c)}"><div class="row"><span>${ICON[c] || '•'}</span><span class="grow">${esc(c)}</span><b>${eur(v)}</b>
      ${cmp ? `<span class="small ${dl > 0 ? 'neg' : 'pos'}" style="width:150px;text-align:right" title="${esc(cmpLabel)}">${p ? `${dl > 0 ? '▲ +' : '▼ −'}${eur(Math.abs(dl))} <span style="opacity:.8">(${dl > 0 ? '+' : '−'}${Math.round(Math.abs(dl) / p * 100)}%)</span>` : 'νέο'}</span>` : ''}</div>
      <div class="bar" style="margin-top:4px"><i style="width:${Math.round((v / max) * 100)}%"></i></div></div>`;
  }).join('');
}

const pages = {
  cars() { return carsList.html([], null, true); },
  bal() { return balancesHtml(); },
  inv() {
    const t = today(); const Y = Number(t.slice(0, 4)); const col = state.user === 'Χαρά' ? 'V' : 'U';
    const l = movements().filter((r) => r.kind === 'Έξοδο' && (r.cat === 'Επενδύσεις' || r.cat === 'Αποταμίευση') && r.d <= t && !r.skipped).map((r) => ({ r, v: Math.abs(fx(r)[col] || 0) })).filter((x) => x.v > 0.004);
    const sum = (f) => l.filter(f).reduce((s, x) => s + x.v, 0);
    const I = (x) => x.r.cat === 'Επενδύσεις', S = (x) => x.r.cat === 'Αποταμίευση';
    const hasS = l.some(S); const yrs = [...new Set(l.map((x) => Number(x.r.d.slice(0, 4))))].sort((a, b) => b - a);
    const ms = Array.from({ length: 12 }, (_, i) => `${Y}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= t.slice(0, 7));
    return `<div class="${hasS ? 'grid2' : ''}"><div class="card kpi"><div class="label">📈 Επενδύσεις συνολικά</div><div class="mid">${eur(sum(I))}</div><div class="small muted">φέτος ${eur(sum((x) => I(x) && x.r.d.startsWith(String(Y))))}</div></div>
      ${hasS ? `<div class="card kpi"><div class="label">🐷 Αποταμίευση συνολικά</div><div class="mid">${eur(sum(S))}</div><div class="small muted">φέτος ${eur(sum((x) => S(x) && x.r.d.startsWith(String(Y))))}</div></div>` : ''}</div>
    <div class="card"><table class="t st"><tr><th>${Y}</th><th class="r">📈 Επενδύσεις</th>${hasS ? '<th class="r">🐷 Αποταμίευση</th>' : ''}</tr>
      ${ms.slice().reverse().map((m) => `<tr><td>${MONTHS[Number(m.slice(5)) - 1]}</td><td class="r">${k0(sum((x) => I(x) && x.r.d.startsWith(m)))}</td>${hasS ? `<td class="r">${k0(sum((x) => S(x) && x.r.d.startsWith(m)))}</td>` : ''}</tr>`).join('')}
      ${yrs.filter((y) => y !== Y).map((y) => `<tr class="muted"><td>${y}</td><td class="r">${k0(sum((x) => I(x) && x.r.d.startsWith(String(y))))}</td>${hasS ? `<td class="r">${k0(sum((x) => S(x) && x.r.d.startsWith(String(y))))}</td>` : ''}</tr>`).join('')}</table>
      <div class="small muted" style="margin-top:6px">σε € · κατηγορίες «Επενδύσεις» και «Αποταμίευση» (δεν μετράνε στα έξοδα)</div></div>`;
  },
  months() {
    const t = today(); selY = selY ?? Number(t.slice(0, 4));
    const ms = Array.from({ length: 12 }, (_, i) => `${selY}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= t.slice(0, 7));
    const rows = ms.map((m) => ({ m, ...ST.month(view, m) }));
    const tot = ST.year(view, selY), ly = ST.year(view, selY - 1);
    const noInc = view === 'Φίλιππος' || (view === 'Κοινά' && !ST.year(view, selY ?? Number(today().slice(0, 4))).inc);
    const inv = false, sav = false;
    return `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-y="-1">◀</button><div class="grow center mid">${selY}</div><button class="btn sm ghost" data-y="1" ${selY >= Number(t.slice(0, 4)) ? 'disabled' : ''}>▶</button></div>
    <div class="card">${bars(ms.map((m) => MSHORT[Number(m.slice(5)) - 1]), [...(noInc ? [] : [{ name: 'Έσοδα', cls: 's-inc', values: rows.map((r) => r.inc) }]), { name: 'Έξοδα', cls: 's-exp', values: rows.map((r) => r.exp) }], ms.map((m) => 'm:' + m))}</div>
    <div class="card"><table class="t st"><tr><th>Μήνας</th>${noInc ? '' : '<th class="r">Έσοδα</th>'}<th class="r">Έξοδα</th>${noInc ? '' : '<th class="r">Διαφορά</th>'}${inv ? '<th class="r">📈 Επενδ.</th>' : ''}${sav ? '<th class="r">🐷 Αποτ.</th>' : ''}<th></th></tr>
      ${rows.slice().reverse().map((r) => `<tr data-k="m:${r.m}" class="click"><td>${MONTHS[Number(r.m.slice(5)) - 1]}</td>${noInc ? '' : `<td class="r pos">${k0(r.inc)}</td>`}<td class="r">${k0(r.exp)}</td>${noInc ? '' : `<td class="r ${r.inc - r.exp < 0 ? 'neg' : 'pos'}">${k0(r.inc - r.exp)}</td>`}${inv ? `<td class="r muted">${r.inv ? k0(r.inv) : ''}</td>` : ''}${sav ? `<td class="r muted">${r.sav ? k0(r.sav) : ''}</td>` : ''}<td class="muted">›</td></tr>`).join('')}
      <tr class="tot"><td>Σύνολο</td>${noInc ? '' : `<td class="r">${k0(tot.inc)}</td>`}<td class="r">${k0(tot.exp)}</td>${noInc ? '' : `<td class="r">${k0(tot.inc - tot.exp)}</td>`}${inv ? `<td class="r">${k0(tot.inv)}</td>` : ''}${sav ? `<td class="r">${k0(tot.sav)}</td>` : ''}<td></td></tr>
      <tr><td>Μ.Ο. μήνα</td>${noInc ? '' : `<td class="r">${k0(tot.inc / ms.length)}</td>`}<td class="r">${k0(tot.exp / ms.length)}</td>${noInc ? '' : `<td class="r">${k0((tot.inc - tot.exp) / ms.length)}</td>`}${inv ? '<td></td>' : ''}${sav ? '<td></td>' : ''}<td></td></tr>
      <tr class="muted"><td>Πέρσι (όλο)</td>${noInc ? '' : `<td class="r">${k0(ly.inc)}</td>`}<td class="r">${k0(ly.exp)}</td>${noInc ? '' : `<td class="r">${k0(ly.inc - ly.exp)}</td>`}${inv ? '<td></td>' : ''}${sav ? '<td></td>' : ''}<td></td></tr></table>
      <div class="small muted" style="margin-top:6px">σε € · πάτα έναν μήνα για ανάλυση</div></div>`;
  },
  month([m]) {
    const s = ST.month(view, m); const ly = ST.month(view, addMonths(`${m}-01`, -12).slice(0, 7));
    const avg = ST.range(view, addMonths(`${m}-01`, -12).slice(0, 7), addMonths(`${m}-01`, -1).slice(0, 7));
    const cats = [...s.cats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    const inc = [...s.icats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    const avgMap = new Map([...avg.cats].map(([c, v]) => [c, v / 12]));
    return `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-back>‹</button><div class="grow mid">${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div>
      <button class="btn sm" data-listm="${m}">Κινήσεις ›</button></div>
    <div class="grid3"><div class="card kpi"><div class="label">Έσοδα</div><div class="mid pos">${eur(s.inc)}</div></div>
      <div class="card kpi"><div class="label">Έξοδα</div><div class="mid">${eur(s.exp)}</div></div>
      <div class="card kpi"><div class="label">Διαφορά</div><div class="mid ${s.inc - s.exp < 0 ? 'neg' : 'pos'}">${eur(s.inc - s.exp)}</div></div></div>
    <div class="small muted" style="margin:0 4px 8px">Ίδιος μήνας πέρσι: έσοδα ${eur(ly.inc)} · έξοδα ${eur(ly.exp)} · Μ.Ο. 12 μηνών: έξοδα ${eur(avg.exp / 12)}</div>
    <h2>Έξοδα ανά κατηγορία <span class="small muted">(▲▼ σε σχέση με τον Μ.Ο. 12 μηνών)</span></h2>
    <div class="card">${catBars(cats, avgMap, 'Μ.Ο. 12 μηνών') || '<span class="muted">—</span>'}</div>
    ${inc.length ? `<h2>Έσοδα</h2><div class="card">${catBars(inc)}</div>` : ''}`;
  },
  years() {
    const t = today(); const Y = Number(t.slice(0, 4)); const f = Number(ST.firstMonth(view).slice(0, 4));
    const ys = []; for (let y = f; y <= Y; y++) ys.push(y);
    const rows = ys.map((y) => ({ y, ...ST.year(view, y) }));
    const noInc = view === 'Φίλιππος' || (view === 'Κοινά' && !ST.year(view, selY ?? Number(today().slice(0, 4))).inc);
    return `<div class="card">${bars(ys.map((y) => String(y).slice(2)), [...(noInc ? [] : [{ name: 'Έσοδα', cls: 's-inc', values: rows.map((r) => r.inc) }]), { name: 'Έξοδα', cls: 's-exp', values: rows.map((r) => r.exp) }], ys.map((y) => 'y:' + y))}</div>
    <div class="card"><table class="t st"><tr><th>Έτος</th>${noInc ? '' : '<th class="r">Έσοδα</th>'}<th class="r">Έξοδα</th>${noInc ? '' : '<th class="r">Διαφορά</th>'}<th class="r">Έξοδα/μήνα</th><th></th></tr>
      ${rows.slice().reverse().map((r) => { const nm = r.y === Y ? Number(t.slice(5, 7)) : 12; return `<tr data-k="y:${r.y}" class="click"><td><b>${r.y}</b></td>${noInc ? '' : `<td class="r pos">${k0(r.inc)}</td>`}<td class="r">${k0(r.exp)}</td>${noInc ? '' : `<td class="r ${r.inc - r.exp < 0 ? 'neg' : 'pos'}">${k0(r.inc - r.exp)}</td>`}<td class="r muted">${k0(r.exp / nm)}</td><td class="muted">›</td></tr>`; }).join('')}</table>
      <div class="small muted" style="margin-top:6px">σε € · πάτα μια χρονιά για ανάλυση</div></div>`;
  },
  year([y]) {
    y = Number(y); const t = today();
    const s = ST.year(view, y), ly = ST.year(view, y - 1);
    const ms = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= t.slice(0, 7));
    const cats = [...s.cats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    const inc = [...s.icats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    return `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-back>‹</button><div class="grow mid">${y}</div></div>
    <div class="grid3"><div class="card kpi"><div class="label">Έσοδα</div><div class="mid pos">${eur(s.inc)}</div><div class="small muted">πέρσι ${eur(ly.inc)}</div></div>
      <div class="card kpi"><div class="label">Έξοδα</div><div class="mid">${eur(s.exp)}</div><div class="small muted">πέρσι ${eur(ly.exp)}</div></div>
      <div class="card kpi"><div class="label">Διαφορά</div><div class="mid ${s.inc - s.exp < 0 ? 'neg' : 'pos'}">${eur(s.inc - s.exp)}</div></div></div>
    <div class="card">${bars(ms.map((m) => MSHORT[Number(m.slice(5)) - 1]), [{ name: 'Έσοδα', cls: 's-inc', values: ms.map((m) => ST.month(view, m).inc) }, { name: 'Έξοδα', cls: 's-exp', values: ms.map((m) => ST.month(view, m).exp) }], ms.map((m) => 'm:' + m), 150)}</div>
    <h2>Έξοδα ανά κατηγορία <span class="small muted">(▲▼ σε σχέση με το ${y - 1})</span></h2>
    <div class="card">${catBars(cats, ly.cats, String(y - 1)) || '—'}</div>
    ${inc.length ? `<h2>Έσοδα</h2><div class="card">${catBars(inc, ly.icats, String(y - 1))}</div>` : ''}`;
  },
  cats() {
    const t = today(); const from = addMonths(`${t.slice(0, 7)}-01`, -11).slice(0, 7);
    const last12 = ST.range(view, from, t.slice(0, 7));
    const all = [...last12.cats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    selCat = selCat && all.some(([c]) => c === selCat) ? selCat : all[0]?.[0];
    if (!selCat) return '<div class="card muted">Καμία κίνηση</div>';
    const ms = Array.from({ length: 24 }, (_, i) => addMonths(`${t.slice(0, 7)}-01`, i - 23).slice(0, 7));
    const vals = ms.map((m) => ST.month(view, m).cats.get(selCat) || 0);
    const Y = Number(t.slice(0, 4)); const f = Number(ST.firstMonth(view).slice(0, 4));
    const yrs = []; for (let y = Y; y >= f; y--) { const v = ST.year(view, y).cats.get(selCat) || 0; if (v) yrs.push([y, v]); }
    // top descriptions in the last 12 months
    const col = Object.fromEntries(VIEWS)[view]; const top = new Map();
    for (const r of movements()) {
      if (r.kind !== 'Έξοδο' || r.d > t || (r.md || r.d).slice(0, 7) < from) continue;
      const c = r.trip ? 'Ταξίδι' : r.cat; if (c !== selCat) continue;
      const v = fx(r)[col]; if (!v) continue; const k = norm(r.desc || '—').trim();
      const x = top.get(k) || { d: r.desc || '—', a: 0, n: 0 }; x.a += v; x.n++; top.set(k, x);
    }
    const tops = [...top.values()].sort((a, b) => b.a - a.a).slice(0, 12);
    return `<div class="chips" style="margin-bottom:10px">${all.map(([c, v]) => `<button class="chip ${c === selCat ? 'on' : ''}" data-c="${esc(c)}">${ICON[c] || ''} ${esc(c)}</button>`).join('')}</div>
    <div class="grid2"><div class="card kpi"><div class="label">Τελευταίοι 12 μήνες</div><div class="mid">${eur(last12.cats.get(selCat) || 0)}</div></div>
      <div class="card kpi"><div class="label">Μ.Ο. μήνα</div><div class="mid">${eur((last12.cats.get(selCat) || 0) / 12)}</div></div></div>
    <div class="card"><div class="small muted" style="margin-bottom:4px">${esc(selCat)} · τελευταίοι 24 μήνες</div>${bars(ms.map(short), [{ name: selCat, cls: 's-exp', values: vals }], ms.map((m) => 'm:' + m), 150)}</div>
    <h2>Πού πήγαν (12 μήνες)</h2>
    <div class="list">${tops.map((x) => `<div class="item" data-q="${esc(x.d)}"><div class="grow"><div class="t">${esc(x.d)}</div><div class="s">${x.n} φορές</div></div><div class="amt">${eur(x.a)}</div></div>`).join('')}</div>
    <h2>Ανά χρονιά</h2>
    <div class="card"><table class="t st">${yrs.map(([y, v]) => `<tr><td>${y}</td><td class="r">${eur(v)}</td><td class="r muted">${eur(v / (y === Y ? Number(t.slice(5, 7)) : 12))}/μήνα</td></tr>`).join('')}</table></div>`;
  },
  trips() {
    const list = T.trips().map((x) => ({ x, s: T.summary(x.name) })).sort((a, b) => ((b.s.to || '9') > (a.s.to || '9') ? 1 : -1));
    return `<div class="row" style="margin-bottom:10px"><div class="grow small muted">Πάτα ένα ταξίδι για τα έξοδά του, τις ημερομηνίες και αλλαγή ονόματος.</div><a class="btn sm primary" href="#/trips">+ / Επεξεργασία</a></div>
    <div class="list">${list.map(({ x, s }) => `<div class="item" data-trip="${esc(x.name)}"><div class="dot">✈️</div>
      <div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${s.from ? dFull(s.from) + ' · ' : ''}${s.days} ${s.days === 1 ? 'μέρα' : 'μέρες'} · ${eur(s.N / s.days)}/μέρα · Άλκης ${eur(s.Q)} · Χαρά ${eur(s.S)}</div></div>
      <div class="amt">${eur(s.N)}</div></div>`).join('') || '<div class="item muted">Κανένα ταξίδι</div>'}</div>`;
  },
  bills() {
    const t = today(); const Y = Number(t.slice(0, 4));
    const B = ST.cube().bills; const kinds = [...new Set(B.map((b) => b.kind))].sort();
    const UNIT = { 'Ρεύμα': 'kWh', 'Νερό': 'm³', 'Θέρμανση': 'μον.' };
    const yrs = [Y, Y - 1, Y - 2, Y - 3, Y - 4];
    const cell = (k, y) => {
      const l = B.filter((b) => b.kind === k && b.d.startsWith(String(y))); const a = l.reduce((s, b) => s + b.a, 0);
      const wc = l.filter((b) => b.cons > 0); const c = wc.reduce((s, b) => s + b.cons, 0), ac = wc.reduce((s, b) => s + b.a, 0);
      return { a, c, per: c ? ac / c : 0, n: l.length };
    };
    return `<div class="note small" style="margin-bottom:10px">Το «Είδος» μπαίνει μόνο του από λέξεις της περιγραφής (Ρυθμίσεις → Κατηγορίες και «Είδος»). Ποσά = όλος ο λογαριασμός.</div>
    <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Είδος</th>${yrs.map((y) => `<th class="r">${y}</th>`).join('')}</tr>
      ${kinds.map((k) => `<tr><td>${esc(k)}</td>${yrs.map((y) => { const c = cell(k, y); return `<td class="r">${c.a ? k0(c.a) : ''}${c.c && UNIT[k] ? `<div class="small muted">${k0(c.c)} ${UNIT[k]} · ${c.per.toFixed(2).replace('.', ',')} €/${UNIT[k]}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table>
      <div class="small muted" style="margin-top:6px">σε € · ${yrs[0]} ως σήμερα</div></div>
    <h2>Τελευταίοι λογαριασμοί</h2>
    <div class="list">${B.slice().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 25).map((b) => `<div class="item" data-edit="${esc(b.sp)}/${esc(b.id)}"><div class="grow"><div class="t">${esc(b.desc)}</div>
      <div class="s">${dFull(b.d)} · ${esc(b.kind)}${b.period ? ' · ' + esc(b.period) : ''}${b.cons ? ' · ' + k0(b.cons) + ' ' + (UNIT[b.kind] || '') : ''}</div></div><div class="amt">${eur(b.a)}</div></div>`).join('')}</div>`;
  },
};

export default {
  live: true,
  html([sub, arg]) {
    const me = state.user; const views = [me, 'Κοινά', 'Φίλιππος'];
    view = view && views.includes(view) ? view : me;
    if (sub && TABS.some(([k]) => k === sub)) tab = sub;
    const body = sub === 'm' ? pages.month([arg]) : sub === 'y' ? pages.year([arg]) : pages[tab]();
    return `<div class="top"><h1>Στατιστικά</h1></div>
    ${(tab === 'bal' || tab === 'inv' || tab === 'cars') && sub !== 'm' && sub !== 'y' ? '' : `<div class="chips" style="margin-bottom:8px">${views.map((v) => `<button class="chip ${v === view ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>`}
    <div class="tabs">${TABS.map(([k, l]) => `<button class="${k === tab && sub !== 'm' && sub !== 'y' ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    ${body}`;
  },
  mount(root, [sub], ui) {
    if (tab === 'bal' && sub !== 'm' && sub !== 'y') balancesMount(root, ui);
    if (tab === 'cars' && sub !== 'm' && sub !== 'y') carsList.mount(root, [], ui);
    root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; ui.render(); }));
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; ui.go(`#/stats/${tab}`); }));
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { selY += Number(b.dataset.y); ui.render(); }));
    root.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { selCat = b.dataset.c; ui.render(); }));
    root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { const [t, v] = b.dataset.k.split(':'); ui.go(`#/stats/${t}/${v}`); }));
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.back());
    root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { selCat = b.dataset.cat; tab = 'cats'; ui.go('#/stats/cats'); }));
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { window.__listSet?.({ q: b.dataset.q }); ui.go('#/list'); }));
    root.querySelector('[data-listm]')?.addEventListener('click', (e) => { window.__listSet?.({ month: e.target.dataset.listm, q: '' }); ui.go('#/list'); });
    root.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('click', () => ui.go(`#/trips/${encodeURIComponent(b.dataset.trip)}`)));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => ui.go(`#/edit/${b.dataset.edit}`)));
  },
};
