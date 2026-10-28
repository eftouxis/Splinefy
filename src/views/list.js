import { esc, eur, today, monthLabel, dShort, norm } from '../util.js';
import { movements, fx, totals } from '../ledger.js';
import { state } from '../store.js';
import { itemHtml, bindEdit, ICON } from './common.js';

let q = '', month = null, spf = 'all', shown = 150;

export default {
  live: true, keepScroll: false,
  html([mode]) {
    const t = today();
    if (mode === 'stats') return stats();
    if (mode === 'shared') spf = 'shared';
    if (mode === 'philippos') { spf = 'all'; q = 'φίλιππος'; }
    if (!month) month = t.slice(0, 7);
    let list = movements().filter((r) => !r.rec || r.d <= t);
    if (spf !== 'all') list = list.filter((r) => (spf === 'shared' ? r._sp === 'shared' : r._sp !== 'shared'));
    if (q) {
      const n = norm(q);
      list = list.filter((r) => norm(`${r.desc} ${r.cat} ${r.note || ''} ${r.trip || ''} ${r.payer} ${r.for}`).includes(n));
    } else list = list.filter((r) => r.d.startsWith(month));
    list.sort((a, b) => (a.d === b.d ? ((b._m || '') > (a._m || '') ? 1 : -1) : a.d < b.d ? 1 : -1));
    const total = list.reduce((s, r) => s + (r.kind === 'Έξοδο' ? r.a || 0 : 0), 0);
    let html = '', lastD = '';
    for (const r of list.slice(0, shown)) {
      if (r.d !== lastD) { html += `<div class="day">${dShort(r.d)}${q ? ' ' + r.d.slice(0, 4) : ''}</div>`; lastD = r.d; }
      html += itemHtml(r, { today: t });
    }
    const multi = state.spaces.filter((s) => s.members.includes(state.user)).length > 1;
    return `<div class="top"><h1>Κινήσεις</h1></div>
    <input type="search" name="q" placeholder="🔍 Αναζήτηση σε όλα (από το 2008)" value="${esc(q)}" style="margin-bottom:10px">
    ${q ? '' : `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${monthLabel(month)}</div><button class="btn sm ghost" data-m="1">▶</button></div>`}
    ${multi ? `<div class="chips" style="margin-bottom:10px">${[['all', 'Όλα'], ['shared', 'Κοινό'], ['mine', 'Προσωπικό']].map(([v, l]) => `<button class="chip ${spf === v ? 'on' : ''}" data-sp="${v}">${l}</button>`).join('')}</div>` : ''}
    <div class="small muted" style="margin:0 2px 6px">${list.length} κινήσεις · έξοδα ${eur(total)}</div>
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
    root.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => { spf = b.dataset.sp; ui.render(); }));
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += 300; ui.render(); });
    bindEdit(root, ui);
  },
};

function stats() {
  const t = today(); const list = movements();
  const me = state.user; const view = me;
  const y = Number(t.slice(0, 4));
  let rows = '';
  for (let yr = y; yr >= y - 18; yr--) {
    const tt = totals(list, view, `${yr}-01-01`, yr === y ? t : `${yr}-12-31`);
    if (!tt.inc && !tt.exp) continue;
    rows += `<tr><td><b>${yr}</b></td><td class="r pos">${eur(tt.inc)}</td><td class="r neg">${eur(tt.exp)}</td><td class="r ${tt.diff < 0 ? 'neg' : 'pos'}">${eur(tt.diff)}</td></tr>`;
  }
  return `<div class="top"><h1>Στατιστικά</h1></div>
  <div class="note" style="margin-bottom:12px">Τα πλήρη στατιστικά (μήνες, κατηγορίες, γραφήματα, ταξίδια, λογαριασμοί) έρχονται στην επόμενη φάση. Εδώ μια πρώτη ματιά ανά χρονιά για ${esc(view)}.</div>
  <div class="card"><table class="t"><tr><th>Έτος</th><th class="r">Έσοδα</th><th class="r">Έξοδα</th><th class="r">Διαφορά</th></tr>${rows}</table></div>`;
}
