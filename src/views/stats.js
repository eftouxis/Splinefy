// #/stats — statistics: months, years, categories, trips, bills
import { esc, eur, today, MONTHS, MSHORT, addMonths, dFull, norm } from '../util.js';
import { state, records } from '../store.js';
import { movements, fx, VIEWS } from '../ledger.js';
import * as ST from '../stats.js';
import { ICON } from './common.js';
import * as T from '../trips.js';
import { sheet } from './lessons/ui.js';
import * as store from '../store.js';
import * as PL from '../plan.js';
import { parseAmount } from '../util.js';
let ymode = (() => { try { return localStorage.getItem('stats-ymode') || 'cal'; } catch { return 'cal'; } })();
const fmtD = (s) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
/** the school-year dates: one start per year (the previous year ends the day before) */
function sySheet(ui, years) {
  sheet(`<div class="mid">🎓 Σχολικές χρονιές</div><div class="small muted">Κάθε χρονιά ξεκινάει από την ημερομηνία που γράφεις και τελειώνει την προηγούμενη μέρα από την έναρξη της επόμενης. Αν δεν αλλάξεις κάτι: 16 Ιουνίου (μετά τις εξετάσεις).</div>
    <div style="margin:10px 0">${years.map((Y) => `<label class="row" style="margin:6px 0;gap:10px"><span style="width:70px"><b>${ST.syLabel(Y)}</b></span><span class="small muted">από</span><input type="date" data-sy="${Y}" value="${ST.syStart(Y)}" style="flex:1"></label>`).join('')}</div>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const starts = { ...(ST.syPref()?.starts || {}) };
      el.querySelectorAll('[data-sy]').forEach((i) => { const Y = i.dataset.sy; if (i.value && i.value !== `${Y}-06-16`) starts[Y] = i.value; else delete starts[Y]; });
      await store.put(ST.syPref()?._sp || PL.goalSpace(), 'syear', { type: 'pref', starts }); close();
    };
  });
}

let view = null, tab = 'months', selY = null, selCat = null;
const TABS = [['months', 'Μήνες'], ['years', 'Χρόνια'], ['cats', 'Κατηγορίες']];
// διάστημα για τις Κατηγορίες
let crange = (() => { try { return JSON.parse(localStorage.getItem('stats-crange')) || { k: '12m' }; } catch { return { k: '12m' }; } })();
const CR = [['m', 'Αυτός ο μήνας'], ['3m', '3 μήνες'], ['6m', '6 μήνες'], ['12m', '12 μήνες'], ['y', 'Φέτος'], ['sy', 'Σχολική χρονιά'], ['c', 'Από–έως']];
const minusYear = (d) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`.replace(/-02-29$/, '-02-28');
function rangeOf(cr = crange) {
  const t = today();
  if (cr.k === 'm') return [`${t.slice(0, 7)}-01`, t];
  if (cr.k === '3m' || cr.k === '6m' || cr.k === '12m') return [addMonths(`${t.slice(0, 7)}-01`, 1 - parseInt(cr.k, 10)), t];
  if (cr.k === 'y') return [`${t.slice(0, 4)}-01-01`, t];
  if (cr.k === 'sy') return [ST.syStart(ST.syOf(t)), t];
  return [cr.from || `${t.slice(0, 4)}-01-01`, cr.to && cr.to < t ? cr.to : t];
}
const monthsIn = (a, b) => { const out = []; for (let m = a.slice(0, 7); m <= b.slice(0, 7); m = addMonths(`${m}-01`, 1).slice(0, 7)) out.push(m); return out; };
const nMonths = (a, b) => Math.max(1, (new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 864e5 / 30.44);
/** κινήσεις ανά κατηγορία μέσα σε διάστημα: πλήθος και περιγραφές */
function catMovs(from, to) {
  const col = Object.fromEntries(VIEWS)[view]; const t = today(); const M = new Map();
  for (const r of movements()) {
    if (r.kind === 'Μεταφορά' || r.d > t || r.skipped) continue; const d = r.md || r.d; if (d < from || d > to) continue;
    const v = fx(r)[col]; if (!v) continue;
    const c = r.kind === 'Έξοδο' && r.trip ? 'Ταξίδι' : r.cat; const key = `${r.kind}|${c}`;
    const g = M.get(key) || { n: 0, descs: new Map() }; g.n++;
    const k = norm(r.desc || '—').trim(); const x = g.descs.get(k) || { d: r.desc || '—', a: 0, n: 0, last: '' }; x.a += Math.abs(v); x.n++; if (r.d > x.last) x.last = r.d; g.descs.set(k, x);
    M.set(key, g);
  }
  return M;
}
const short = (m) => `${MSHORT[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;
const k0 = (x) => eur(x).replace(' €', '');

/** grouped bars: series = [{name, cls, values}] ; labels = x labels ; onclick keys */
export function bars(labels, series, keys = [], h = 170) {
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
export function catBars(entries, cmp = null, cmpLabel = '') {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return entries.map(([c, v]) => {
    const p = cmp?.get(c) || 0; const dl = v - p;
    return `<div class="cbar click" data-cat="${esc(c)}" data-kind="${cmpLabel === '@inc' || entries.inc ? 'Έσοδο' : 'Έξοδο'}"><div class="row"><span>${ICON[c] || '•'}</span><span class="grow">${esc(c)}</span><b>${eur(v)}</b>
      ${cmp ? `<span class="small ${dl > 0 ? 'neg' : 'pos'}" style="width:150px;text-align:right" title="${esc(cmpLabel)}">${p ? `${dl > 0 ? '▲ +' : '▼ −'}${eur(Math.abs(dl))} <span style="opacity:.8">(${dl > 0 ? '+' : '−'}${Math.round(Math.abs(dl) / p * 100)}%)</span>` : 'νέο'}</span>` : ''}</div>
      <div class="bar" style="margin-top:4px"><i style="width:${Math.round((v / max) * 100)}%"></i></div></div>`;
  }).join('');
}

const pages = {
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
    ${inc.length ? `<h2>Έσοδα</h2><div class="card">${catBars(Object.assign(inc, { inc: 1 }))}</div>` : ''}`;
  },
  years() {
    const mode = `<div class="row" style="margin-bottom:8px"><div class="chips grow" style="margin:0"><button class="chip ${ymode === 'cal' ? 'on' : ''}" data-ym="cal">📅 Ημερολογιακά</button><button class="chip ${ymode === 'sch' ? 'on' : ''}" data-ym="sch">🎓 Σχολικά</button></div>${ymode === 'sch' ? '<button class="btn sm" data-sydates>Ημερομηνίες ›</button>' : ''}</div>`;
    return mode + (ymode === 'sch' ? pages.syears() : pages.cyears());
  },
  syears() {
    const t = today(); const Y = ST.syOf(t); const f = ST.syOf(`${ST.firstMonth(view)}-01`);
    const ys = []; for (let y = f; y <= Y; y++) ys.push(y);
    const rows = ys.map((y) => ({ y, ...ST.schoolYear(view, y) }));
    const noInc = view === 'Φίλιππος' || (view === 'Κοινά' && !rows[rows.length - 1]?.inc);
    const months = (y) => { const e = ST.syEnd(y) < t ? ST.syEnd(y) : t; const s = ST.syStart(y); return Math.max(1, (Number(e.slice(0, 4)) - Number(s.slice(0, 4))) * 12 + Number(e.slice(5, 7)) - Number(s.slice(5, 7)) + (Number(e.slice(8)) - Number(s.slice(8)) + 1) / 30); };
    const cur = rows[rows.length - 1], prev = rows[rows.length - 2];
    const prevSame = prev ? ST.dayRange(view, ST.syStart(Y - 1), (() => { const d = new Date(t + 'T12:00'); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })()) : null;
    return `<div class="card"><div class="row"><b class="grow">Φέτος ${ST.syLabel(Y)}</b><span class="small muted">${fmtD(ST.syStart(Y))} – σήμερα</span></div>
      <div class="grid3 center" style="margin-top:8px">${noInc ? '' : `<div><div class="small muted">Έσοδα</div><div class="mid pos">${eur(cur.inc)}</div></div>`}<div><div class="small muted">Έξοδα</div><div class="mid">${eur(cur.exp)}</div></div>${noInc ? '' : `<div><div class="small muted">Διαφορά</div><div class="mid ${cur.inc - cur.exp < 0 ? 'neg' : 'pos'}">${eur(cur.inc - cur.exp)}</div></div>`}</div>
      ${prevSame ? `<div class="small muted center" style="margin-top:6px">Ίδιο διάστημα πέρσι (${ST.syLabel(Y - 1)}): ${noInc ? '' : `έσοδα ${eur(prevSame.inc)} · `}έξοδα ${eur(prevSame.exp)}${noInc ? '' : ` · διαφορά ${eur(prevSame.inc - prevSame.exp)}`}</div>` : ''}</div>
    <div class="card">${bars(ys.map((y) => ST.syLabel(y).slice(2)), [...(noInc ? [] : [{ name: 'Έσοδα', cls: 's-inc', values: rows.map((r) => r.inc) }]), { name: 'Έξοδα', cls: 's-exp', values: rows.map((r) => r.exp) }], ys.map((y) => 'sy:' + y))}</div>
    <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Χρονιά</th>${noInc ? '' : '<th class="r">Έσοδα</th>'}<th class="r">Έξοδα</th>${noInc ? '' : '<th class="r">Διαφορά</th>'}<th class="r">/μήνα</th><th></th></tr>
      ${rows.slice().reverse().map((r) => `<tr data-k="sy:${r.y}" class="click"><td><b>${ST.syLabel(r.y)}</b></td>${noInc ? '' : `<td class="r pos">${k0(r.inc)}</td>`}<td class="r">${k0(r.exp)}</td>${noInc ? '' : `<td class="r ${r.inc - r.exp < 0 ? 'neg' : 'pos'}">${k0(r.inc - r.exp)}</td>`}<td class="r muted">${k0(r.exp / months(r.y))}</td><td class="muted">›</td></tr>`).join('')}</table>
      <div class="small muted" style="margin-top:6px">σε € · σχολική χρονιά = από ${fmtD(ST.syStart(Y)).slice(0, 5)} ως ${fmtD(ST.syEnd(Y)).slice(0, 5)} (αλλάζει από «Ημερομηνίες») · πάτα μια χρονιά για ανάλυση</div></div>`;
  },
  syear([y]) {
    y = Number(y); const t = today(); const s0 = ST.syStart(y), e0 = ST.syEnd(y) < t ? ST.syEnd(y) : t;
    const s = ST.dayRange(view, s0, e0), ly = ST.schoolYear(view, y - 1);
    const ms = []; for (let m = s0.slice(0, 7); m <= e0.slice(0, 7); m = addMonths(`${m}-01`, 1).slice(0, 7)) ms.push(m);
    const mv = ms.map((m) => ST.dayRange(view, `${m}-01` < s0 ? s0 : `${m}-01`, `${m}-31` > e0 ? e0 : `${m}-31`));
    const cats = [...s.cats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    const inc = [...s.icats.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    return `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-back>‹</button><div class="grow mid">Σχολική χρονιά ${ST.syLabel(y)}</div></div>
    <div class="small muted" style="margin:-4px 4px 8px">${fmtD(s0)} – ${fmtD(ST.syEnd(y))}${e0 === t && ST.syEnd(y) > t ? ' (ως σήμερα)' : ''}</div>
    <div class="grid3"><div class="card kpi"><div class="label">Έσοδα</div><div class="mid pos">${eur(s.inc)}</div><div class="small muted">πέρσι ${eur(ly.inc)}</div></div>
      <div class="card kpi"><div class="label">Έξοδα</div><div class="mid">${eur(s.exp)}</div><div class="small muted">πέρσι ${eur(ly.exp)}</div></div>
      <div class="card kpi"><div class="label">Διαφορά</div><div class="mid ${s.inc - s.exp < 0 ? 'neg' : 'pos'}">${eur(s.inc - s.exp)}</div><div class="small muted">πέρσι ${eur(ly.inc - ly.exp)}</div></div></div>
    <div class="card">${bars(ms.map((m) => MSHORT[Number(m.slice(5)) - 1]), [{ name: 'Έσοδα', cls: 's-inc', values: mv.map((x) => x.inc) }, { name: 'Έξοδα', cls: 's-exp', values: mv.map((x) => x.exp) }], ms.map((m) => 'm:' + m), 150)}</div>
    <h2>Έξοδα ανά κατηγορία <span class="small muted">(▲▼ σε σχέση με ${ST.syLabel(y - 1)})</span></h2>
    <div class="card">${catBars(cats, ly.cats, ST.syLabel(y - 1)) || '—'}</div>
    ${inc.length ? `<h2>Έσοδα</h2><div class="card">${catBars(Object.assign(inc, { inc: 1 }), ly.icats, ST.syLabel(y - 1))}</div>` : ''}`;
  },
  cyears() {
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
    ${inc.length ? `<h2>Έσοδα</h2><div class="card">${catBars(Object.assign(inc, { inc: 1 }), ly.icats, String(y - 1))}</div>` : ''}`;
  },
  cats() {
    const [from, to] = rangeOf(); const pf = minusYear(from), pt = minusYear(to);
    const cur = ST.dayRange(view, from, to), prev = ST.dayRange(view, pf, pt); const cm = catMovs(from, to);
    const nm = nMonths(from, to);
    const list = (m, kind, cmp) => [...m.entries()].filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]).map(([c, v]) => {
      const p = cmp.get(c) || 0, dl = v - p, n = cm.get(`${kind}|${c}`)?.n || 0;
      return `<div class="item click" data-cd="${esc(kind)}|${esc(c)}"><div class="dot">${ICON[c] || '•'}</div>
        <div class="grow"><div class="t">${esc(c)} <span class="cnt">${n}</span></div><div class="s">${eur(v / nm)}/μήνα${p ? ` · πέρσι ${eur(p)}` : ''}</div></div>
        <div style="text-align:right"><div class="amt ${kind === 'Έσοδο' ? 'pos' : ''}">${eur(v)}</div>${p ? `<div class="small ${(dl > 0) === (kind === 'Έξοδο') ? 'neg' : 'pos'}">${dl > 0 ? '▲' : '▼'} ${Math.round(Math.abs(dl) / p * 100)}%</div>` : '<div class="small muted">νέο</div>'}</div></div>`;
    }).join('');
    const exp = list(cur.cats, 'Έξοδο', prev.cats), inc = list(cur.icats, 'Έσοδο', prev.icats);
    return `${rangeBar(from, to)}
    <div class="grid2"><div class="card kpi"><div class="label">Έξοδα</div><div class="mid">${eur(cur.exp)}</div><div class="small muted">ίδιο διάστημα πέρσι ${eur(prev.exp)}</div></div>
      <div class="card kpi"><div class="label">Έσοδα</div><div class="mid pos">${eur(cur.inc)}</div><div class="small muted">ίδιο διάστημα πέρσι ${eur(prev.inc)}</div></div></div>
    <h2>Έξοδα</h2><div class="list">${exp || '<div class="item muted">—</div>'}</div>
    ${inc ? `<h2>Έσοδα</h2><div class="list">${inc}</div>` : ''}`;
  },
  /** μία κατηγορία μέσα στο διάστημα: ανά μήνα, πού πήγαν, ανά χρονιά, κινήσεις */
  cat([key]) {
    key = decodeURIComponent(key || ''); const [kind, c] = key.includes('|') ? key.split('|') : ['Έξοδο', key];
    const [from, to] = rangeOf(); const t = today(); const nm = nMonths(from, to);
    const pick = (x) => (kind === 'Έσοδο' ? x.icats : x.cats).get(c) || 0;
    const tot = pick(ST.dayRange(view, from, to)), prev = pick(ST.dayRange(view, minusYear(from), minusYear(to)));
    const ms = monthsIn(from, to);
    const mv = ms.map((m) => pick(ST.dayRange(view, `${m}-01` < from ? from : `${m}-01`, `${m}-31` > to ? to : `${m}-31`)));
    const g = catMovs(from, to).get(`${kind}|${c}`); const tops = g ? [...g.descs.values()].sort((a, b) => b.a - a.a).slice(0, 15) : [];
    const Y = Number(t.slice(0, 4)); const f = Number(ST.firstMonth(view).slice(0, 4));
    const yrs = []; for (let y = Y; y >= f; y--) { const v = pick(ST.year(view, y)); if (v) yrs.push([y, v]); }
    return `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-back>‹</button><div class="grow mid">${ICON[c] || ''} ${esc(c)}</div>
      <button class="btn sm" data-catlist="${esc(kind)}|${esc(c)}">Κινήσεις ›</button></div>
    ${rangeBar(from, to)}
    <div class="grid3"><div class="card kpi"><div class="label">Σύνολο</div><div class="mid">${eur(tot)}</div><div class="small muted">${g?.n || 0} κινήσεις</div></div>
      <div class="card kpi"><div class="label">Μ.Ο. μήνα</div><div class="mid">${eur(tot / nm)}</div></div>
      <div class="card kpi"><div class="label">Ίδιο διάστημα πέρσι</div><div class="mid">${eur(prev)}</div>${prev ? `<div class="small ${(tot > prev) === (kind === 'Έξοδο') ? 'neg' : 'pos'}">${tot > prev ? '▲' : '▼'} ${Math.round(Math.abs(tot - prev) / prev * 100)}%</div>` : ''}</div></div>
    ${ms.length > 1 ? `<div class="card">${bars(ms.map(short), [{ name: c, cls: kind === 'Έσοδο' ? 's-inc' : 's-exp', values: mv }], ms.map((m) => 'cm:' + m), 150)}<div class="small muted">πάτα έναν μήνα για τις κινήσεις του</div></div>` : ''}
    <h2>Πού πήγαν</h2>
    <div class="list">${tops.map((x) => `<div class="item click" data-q="${esc(x.d)}"><div class="grow"><div class="t">${esc(x.d)}</div><div class="s">${x.n} ${x.n === 1 ? 'φορά' : 'φορές'} · τελευταία ${dFull(x.last)}</div></div><div class="amt">${eur(x.a)}</div></div>`).join('') || '<div class="item muted">—</div>'}</div>
    ${yrs.length ? `<h2>Ανά χρονιά</h2><div class="list">${yrs.map(([y, v]) => `<div class="item click" data-cy="${y}"><div class="grow t">${y}</div><div class="small muted" style="margin-right:10px">${eur(v / (y === Y ? Number(t.slice(5, 7)) : 12))}/μήνα</div><div class="amt">${eur(v)}</div></div>`).join('')}</div>` : ''}`;
  },
};
function rangeBar(from, to) {
  return `<div class="chips" style="margin-bottom:6px">${CR.map(([k, l]) => `<button class="chip ${crange.k === k ? 'on' : ''}" data-cr="${k}">${l}</button>`).join('')}</div>
    ${crange.k === 'c' ? `<div class="row" style="gap:6px;margin-bottom:8px"><input type="date" data-crf value="${esc(from)}" style="flex:1"><span class="small muted">έως</span><input type="date" data-crt value="${esc(to)}" style="flex:1"></div>` : `<div class="small muted" style="margin:0 4px 8px">${fmtD(from)} – ${fmtD(to)}</div>`}`;
}

const listView = () => (view === 'Κοινά' ? 'home' : view === 'Φίλιππος' ? 'phil' : 'mine');
export default {
  live: true,
  html([sub, arg]) {
    const me = state.user; const views = [me, 'Κοινά', 'Φίλιππος'];
    view = view && views.includes(view) ? view : me;
    if (sub && TABS.some(([k]) => k === sub)) tab = sub;
    if (!TABS.some(([k]) => k === tab)) tab = 'months';
    const body = sub === 'c' ? pages.cat([arg]) : sub === 'm' ? pages.month([arg]) : sub === 'y' ? pages.year([arg]) : sub === 'sy' ? pages.syear([arg]) : pages[tab]();
    return `<div class="top"><h1>Στατιστικά</h1></div>
    <div class="chips" style="margin-bottom:8px">${views.map((v) => `<button class="chip ${v === view ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
    ${view === 'Φίλιππος' ? '<a class="card row" href="#/philippos" style="text-decoration:none;color:inherit"><span class="grow"><b>👶 Πορτοφόλι Φιλίππου</b><div class="small muted">υπόλοιπο, ό,τι μπήκε και ξοδεύτηκε, μεταφορές</div></span><span class="muted">›</span></a>' : ''}
    ${sub === 'c' ? '' : `<div class="tabs">${TABS.map(([k, l]) => `<button class="${k === tab && sub !== 'm' && sub !== 'y' && sub !== 'sy' ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>`}
    ${body}`;
  },
  mount(root, [sub, arg], ui) {
    root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; ui.render(); }));
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; ui.go(`#/stats/${tab}`); }));
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { selY += Number(b.dataset.y); ui.render(); }));
    root.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { selCat = b.dataset.c; ui.render(); }));
    root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { const [t, v] = b.dataset.k.split(':');
      if (t === 'cm') { const [kind, c] = decodeURIComponent(arg).split('|'); window.__listSet?.({ month: v, q: '', cat: c, kind, view: listView() }); ui.go('#/list'); return; }
      ui.go(`#/stats/${t}/${v}`); }));
    const saveCr = () => { try { localStorage.setItem('stats-crange', JSON.stringify(crange)); } catch {} ui.render(); };
    root.querySelectorAll('[data-cr]').forEach((b) => b.addEventListener('click', () => { const [f, tt] = rangeOf(); crange = b.dataset.cr === 'c' ? { k: 'c', from: f, to: tt } : { k: b.dataset.cr }; saveCr(); }));
    root.querySelector('[data-crf]')?.addEventListener('change', (e) => { crange.from = e.target.value; saveCr(); });
    root.querySelector('[data-crt]')?.addEventListener('change', (e) => { crange.to = e.target.value; saveCr(); });
    root.querySelectorAll('[data-cd]').forEach((b) => b.addEventListener('click', () => ui.go(`#/stats/c/${encodeURIComponent(b.dataset.cd)}`)));
    root.querySelectorAll('[data-cy]').forEach((b) => b.addEventListener('click', () => { const y = b.dataset.cy; crange = { k: 'c', from: `${y}-01-01`, to: `${y}-12-31` }; saveCr(); }));
    root.querySelector('[data-catlist]')?.addEventListener('click', (e) => { const [kind, c] = e.target.dataset.catlist.split('|'); const [f, tt] = rangeOf(); window.__listSet?.({ q: '', from: f, to: tt, cat: c, kind, view: listView() }); ui.go('#/list'); });
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.back());
    root.querySelectorAll('[data-ym]').forEach((b) => b.addEventListener('click', () => { ymode = b.dataset.ym; try { localStorage.setItem('stats-ymode', ymode); } catch {} ui.render(); }));
    root.querySelector('[data-sydates]')?.addEventListener('click', () => { const t = today(); const Y = ST.syOf(t), f = Math.max(ST.syOf(`${ST.firstMonth(view)}-01`), Y - 6); const ys = []; for (let y = Y + 1; y >= f; y--) ys.push(y); sySheet(ui, ys); });
    // κατηγορία σε μήνα → οι κινήσεις της· σε χρονιά → η κατηγορία για όλη τη χρονιά
    root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.cat, kind = b.dataset.kind;
      if (sub === 'm') { window.__listSet?.({ month: arg, q: '', cat: c, kind, view: listView() }); ui.go('#/list'); return; }
      if (sub === 'y') crange = { k: 'c', from: `${arg}-01-01`, to: `${arg}-12-31` };
      else if (sub === 'sy') crange = { k: 'c', from: ST.syStart(Number(arg)), to: ST.syEnd(Number(arg)) };
      try { localStorage.setItem('stats-crange', JSON.stringify(crange)); } catch {}
      ui.go(`#/stats/c/${encodeURIComponent(`${kind}|${c}`)}`);
    }));
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { const [f, tt] = sub === 'c' ? rangeOf() : []; window.__listSet?.({ q: b.dataset.q, ...(f ? { from: f, to: tt } : {}), view: listView() }); ui.go('#/list'); }));
    root.querySelector('[data-listm]')?.addEventListener('click', (e) => { window.__listSet?.({ month: e.target.dataset.listm, q: '' }); ui.go('#/list'); });
    root.querySelectorAll('[data-trip]').forEach((b) => b.addEventListener('click', () => ui.go(`#/trips/${encodeURIComponent(b.dataset.trip)}`)));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => ui.go(`#/edit/${b.dataset.edit}`)));
  },
};
