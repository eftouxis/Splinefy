// #/inv — Επενδύσεις και αποταμίευση: σύνολα, ανά χρονιά και μήνα· πατάς για τις κινήσεις
import { eur, today, MONTHS } from '../util.js';
import { state } from '../store.js';
import { movements, fx } from '../ledger.js';

let selY = null;
export default {
  live: true,
  html() {
    const t = today(); const Y = Number(t.slice(0, 4)); selY = selY || Y; const col = state.user === 'Χαρά' ? 'V' : 'U';
    const l = movements().filter((r) => r.kind === 'Έξοδο' && (r.cat === 'Επενδύσεις' || r.cat === 'Αποταμίευση') && r.d <= t && !r.skipped).map((r) => ({ r, v: Math.abs(fx(r)[col] || 0) })).filter((x) => x.v > 0.004);
    const sum = (f) => l.filter(f).reduce((s, x) => s + x.v, 0);
    const I = (x) => x.r.cat === 'Επενδύσεις', S = (x) => x.r.cat === 'Αποταμίευση';
    const hasS = l.some(S); const yrs = [...new Set(l.map((x) => Number(x.r.d.slice(0, 4))))].sort((a, b) => b - a);
    const ms = Array.from({ length: 12 }, (_, i) => `${selY}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= t.slice(0, 7));
    const cell = (f, key, cat) => { const v = sum(f); return `<td class="r ${v ? 'click' : 'muted'}" ${v ? `data-l="${key}|${cat}"` : ''}>${v ? eur(v) : '—'}</td>`; };
    return `<div class="top"><h1>Επενδύσεις</h1></div>
    <div class="${hasS ? 'grid2' : ''}"><div class="card kpi click" data-l="all|Επενδύσεις"><div class="label">📈 Επενδύσεις συνολικά</div><div class="mid">${eur(sum(I))}</div><div class="small muted">φέτος ${eur(sum((x) => I(x) && x.r.d.startsWith(String(Y))))}</div></div>
      ${hasS ? `<div class="card kpi click" data-l="all|Αποταμίευση"><div class="label">🐷 Αποταμίευση συνολικά</div><div class="mid">${eur(sum(S))}</div><div class="small muted">φέτος ${eur(sum((x) => S(x) && x.r.d.startsWith(String(Y))))}</div></div>` : ''}</div>
    <h2>Ανά χρονιά</h2>
    <div class="card"><table class="t st"><tr><th>Έτος</th><th class="r">📈 Επενδύσεις</th>${hasS ? '<th class="r">🐷 Αποταμίευση</th>' : ''}</tr>
      ${yrs.map((y) => `<tr><td><button class="btn sm ${y === selY ? 'primary' : 'ghost'}" data-y="${y}">${y}</button></td>${cell((x) => I(x) && x.r.d.startsWith(String(y)), `y${y}`, 'Επενδύσεις')}${hasS ? cell((x) => S(x) && x.r.d.startsWith(String(y)), `y${y}`, 'Αποταμίευση') : ''}</tr>`).join('') || '<tr><td colspan="3" class="muted">Τίποτα ακόμα — βάλε κατηγορία «Επενδύσεις» ή «Αποταμίευση» σε ένα έξοδο</td></tr>'}</table></div>
    ${yrs.length ? `<h2>${selY} ανά μήνα</h2>
    <div class="card"><table class="t st"><tr><th>Μήνας</th><th class="r">📈</th>${hasS ? '<th class="r">🐷</th>' : ''}</tr>
      ${ms.slice().reverse().map((m) => `<tr><td>${MONTHS[Number(m.slice(5)) - 1]}</td>${cell((x) => I(x) && (x.r.md || x.r.d).startsWith(m), `m${m}`, 'Επενδύσεις')}${hasS ? cell((x) => S(x) && (x.r.md || x.r.d).startsWith(m), `m${m}`, 'Αποταμίευση') : ''}</tr>`).join('')}</table>
      <div class="small muted" style="margin-top:6px">πάτα ένα ποσό για τις κινήσεις</div></div>` : ''}`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { selY = Number(b.dataset.y); ui.render(); }));
    root.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => {
      const [key, cat] = b.dataset.l.split('|'); const o = { q: '', cat, kind: 'Έξοδο', view: 'mine' };
      if (key === 'all') Object.assign(o, { from: '2000-01-01', to: '2100-12-31' });
      else if (key[0] === 'y') Object.assign(o, { from: `${key.slice(1)}-01-01`, to: `${key.slice(1)}-12-31` });
      else o.month = key.slice(1);
      window.__listSet?.(o); ui.go('#/list');
    }));
  },
};
