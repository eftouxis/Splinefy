import { esc, eur, today, monthLabel, dShort, norm } from '../util.js';
import { movements, fx, totals } from '../ledger.js';
import { state } from '../store.js';
import { itemHtml, bindEdit, ICON } from './common.js';

let q = '', month = null, spf = 'all', shown = 150, rng = null;
window.__listSet = (o) => { if (o.q !== undefined) q = o.q; if (o.month) { month = o.month; rng = null; } if (o.from) rng = [o.from, o.to]; spf = 'all'; shown = 150; };

export default {
  live: true, keepScroll: false,
  html([mode]) {
    const t = today();
    if (mode === 'stats') { location.replace('#/stats'); return ''; }
    if (mode === 'shared') spf = 'shared';
    if (mode === 'philippos') { spf = 'all'; q = 'φίλιππος'; }
    if (!month) month = t.slice(0, 7);
    let list = movements().filter((r) => !r.rec || r.d <= t);
    if (spf !== 'all') list = list.filter((r) => (spf === 'shared' ? r._sp === 'shared' : r._sp !== 'shared'));
    if (q) {
      const n = norm(q);
      list = list.filter((r) => norm(`${r.desc} ${r.cat} ${r.note || ''} ${r.trip || ''} ${r.payer} ${r.for}`).includes(n));
    } else if (rng) list = list.filter((r) => r.d >= rng[0] && r.d <= rng[1]);
    else list = list.filter((r) => r.d.startsWith(month));
    list.sort((a, b) => (a.d === b.d ? ((b._m || '') > (a._m || '') ? 1 : -1) : a.d < b.d ? 1 : -1));
    const sum = (k) => list.reduce((s, r) => s + (r.kind === k && !r.skipped ? r.a || 0 : 0), 0);
    const exp = sum('Έξοδο'), inc = sum('Έσοδο');
    let html = '', lastD = '';
    for (const r of list.slice(0, shown)) {
      if (r.d !== lastD) { html += `<div class="day">${dShort(r.d)}${q ? ' ' + r.d.slice(0, 4) : ''}</div>`; lastD = r.d; }
      html += itemHtml(r, { today: t });
    }
    const multi = state.spaces.filter((s) => s.members.includes(state.user)).length > 1;
    return `<div class="top"><h1>Κινήσεις</h1></div>
    <input type="search" name="q" placeholder="🔍 Αναζήτηση σε όλα (από το 2008)" value="${esc(q)}" style="margin-bottom:10px">
    ${q ? '' : rng ? `<div class="row" style="margin-bottom:8px"><div class="grow center mid">${rng[0].split('-').reverse().join('/')} – ${rng[1].split('-').reverse().join('/')}</div><button class="btn sm ghost" data-norng>✕</button></div>` : `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${monthLabel(month)}</div><button class="btn sm ghost" data-m="1">▶</button></div>`}
    ${multi ? `<div class="chips" style="margin-bottom:10px">${[['all', 'Όλα'], ['shared', 'Κοινό'], ['mine', 'Προσωπικό']].map(([v, l]) => `<button class="chip ${spf === v ? 'on' : ''}" data-sp="${v}">${l}</button>`).join('')}</div>` : ''}
    <div class="card grid3 center" style="padding:10px 6px;margin-bottom:8px">
      <div><div class="small muted">Έσοδα</div><b class="pos">${eur(inc)}</b></div>
      <div><div class="small muted">Έξοδα</div><b class="neg">${eur(exp)}</b></div>
      <div><div class="small muted">Διαφορά</div><b class="${inc - exp < 0 ? 'neg' : 'pos'}">${eur(inc - exp)}</b></div></div>
    <div class="small muted" style="margin:0 2px 6px">${list.length} κινήσεις${q ? ` που περιέχουν «${esc(q)}» (σε περιγραφή, κατηγορία, σημείωση ή ταξίδι)` : ''} · ολόκληρα ποσά, όχι μόνο το μερίδιό σου</div>
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
    root.querySelector('[data-norng]')?.addEventListener('click', () => { rng = null; ui.render(); });
    root.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => { spf = b.dataset.sp; ui.render(); }));
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += 300; ui.render(); });
    bindEdit(root, ui);
  },
};
