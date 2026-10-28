import { esc, eur, today, monthLabel, dShort, norm } from '../util.js';
import { movements, fx, othSum } from '../ledger.js';
import { state } from '../store.js';
import { itemHtml, bindEdit, ICON } from './common.js';

let q = '', month = null, shown = 150, rng = null, view = 'mine';
window.__listSet = (o) => { if (o.q !== undefined) q = o.q; if (o.month) { month = o.month; rng = null; } if (o.from) rng = [o.from, o.to]; shown = 150; };
const VIEWS_L = [['mine', 'Τα δικά μου'], ['home', 'Κοινά σπιτιού'], ['phil', 'Φίλιππος'], ['all', 'Όλες']];
const when = (r) => r.md || r.d;            // salaries count in the month they concern

export default {
  live: true, keepScroll: false,
  html([mode]) {
    const t = today();
    if (mode === 'stats') { location.replace('#/stats'); return ''; }
    if (mode === 'shared') view = 'home';
    if (mode === 'philippos') view = 'phil';
    if (!month) month = t.slice(0, 7);
    let list = movements().filter((r) => (!r.rec || r.d <= t) && !r.skipped);
    if (q) {
      const n = norm(q);
      list = list.filter((r) => norm(`${r.desc} ${r.cat} ${r.note || ''} ${r.trip || ''} ${r.payer} ${r.for}`).includes(n));
    } else if (rng) list = list.filter((r) => when(r) >= rng[0] && when(r) <= rng[1]);
    else list = list.filter((r) => when(r).startsWith(month));
    const col = state.user === 'Χαρά' ? 'V' : 'U';          // my share, same as the home page
    const mine = (r) => Math.abs(fx(r, '9999-12-31')[col] || 0);
    const O = (r) => fx(r).O;
    const keep = { mine: (r) => r.kind !== 'Μεταφορά' && mine(r) > 0.004, home: (r) => r.kind !== 'Μεταφορά' && O(r) === 'Κοινό', phil: (r) => O(r) === 'Φίλιππος' || r.payer === 'Φίλιππος', all: () => true }[view];
    const hidden = list.length; list = list.filter(keep);
    const extra = hidden - list.length;
    const val = (r) => (view === 'mine' ? mine(r) : (r.a || 0) - (view === 'all' ? 0 : othSum(r)));
    list.sort((a, b) => (a.d === b.d ? ((b._m || '') > (a._m || '') ? 1 : -1) : a.d < b.d ? 1 : -1));
    const sum = (k) => list.reduce((s, r) => s + (r.kind === k ? val(r) : 0), 0);
    const exp = sum('Έξοδο'), inc = sum('Έσοδο');
    let html = '', lastD = '';
    for (const r of list.slice(0, shown)) {
      if (r.d !== lastD) { html += `<div class="day">${dShort(r.d)}${q || r.d.slice(0, 7) !== when(r).slice(0, 7) ? ' ' + r.d.slice(0, 4) : ''}</div>`; lastD = r.d; }
      html += itemHtml(r, { today: t, amt: view === 'mine' ? val(r) : null });
    }
    const note = { mine: 'Μόνο ό,τι σε βαραίνει και μόνο το μερίδιό σου (όπως η αρχική)', home: 'Κοινά έξοδα και έσοδα του σπιτιού — ολόκληρα ποσά', phil: 'Κινήσεις του Φιλίππου', all: 'Όλες οι κινήσεις — ολόκληρα ποσά' }[view];
    return `<div class="top"><h1>Κινήσεις</h1></div>
    <input type="search" name="q" placeholder="🔍 Αναζήτηση σε όλα (από το 2008)" value="${esc(q)}" style="margin-bottom:10px">
    ${q ? '' : rng ? `<div class="row" style="margin-bottom:8px"><div class="grow center mid">${rng[0].split('-').reverse().join('/')} – ${rng[1].split('-').reverse().join('/')}</div><button class="btn sm ghost" data-norng>✕</button></div>` : `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${monthLabel(month)}</div><button class="btn sm ghost" data-m="1">▶</button></div>`}
    <div class="chips" style="margin-bottom:10px">${VIEWS_L.map(([v, l]) => `<button class="chip ${view === v ? 'on' : ''}" data-view="${v}">${l}</button>`).join('')}</div>
    <div class="card grid3 center" style="padding:10px 6px;margin-bottom:8px">
      <div><div class="small muted">Έσοδα</div><b class="pos">${eur(inc)}</b></div>
      <div><div class="small muted">Έξοδα</div><b class="neg">${eur(exp)}</b></div>
      <div><div class="small muted">Διαφορά</div><b class="${inc - exp < 0 ? 'neg' : 'pos'}">${eur(inc - exp)}</b></div></div>
    <div class="small muted" style="margin:0 2px 6px">${note} · ${list.length} κινήσεις${q ? ` με «${esc(q)}»` : ''}${extra && view !== 'all' ? ` · ${extra} ακόμα στις «Όλες»` : ''}</div>
    <div class="list">${html || '<div class="item muted">Καμία κίνηση</div>'}</div>
    ${list.length > shown ? `<div class="center" style="margin-top:10px"><button class="btn sm" data-more>Περισσότερες…</button></div>` : ''}`;
  },
  mount(root, p, ui) {
    const qi = root.querySelector('[name=q]');
    qi?.addEventListener('input', () => { q = qi.value; shown = 150; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const n = document.querySelector('[name=q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + Number(b.dataset.m), 1);
      month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; ui.render();
    }));
    root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; shown = 150; ui.render(); }));
    root.querySelector('[data-norng]')?.addEventListener('click', () => { rng = null; ui.render(); });
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += 300; ui.render(); });
    bindEdit(root, ui);
  },
};
