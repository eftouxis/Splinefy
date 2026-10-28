// #/philippos — Φίλιππος' money that Άλκης keeps: what came in (gifts, allowances), what went out (expenses for him), balance
import { esc, eur, today, dShort, MSHORT } from '../util.js';
import { movements, fx } from '../ledger.js';
import { bindEdit, ICON } from './common.js';

let selY = 'all';
export default {
  live: true,
  html() {
    const t = today();
    const all = movements().filter((r) => r._sp === 'shared' && r.d <= t && !r.skipped).map((r) => ({ r, T: fx(r).T })).filter((x) => Math.abs(x.T) > 0.004)
      .sort((a, b) => (a.r.d < b.r.d ? -1 : a.r.d > b.r.d ? 1 : 0));
    let run = 0; for (const x of all) { run += x.T; x.bal = run; }
    const bal = run;
    const yrs = [...new Set(all.map((x) => x.r.d.slice(0, 4)))].sort().reverse();
    const sel = selY === 'all' ? all : all.filter((x) => x.r.d.startsWith(selY));
    const inn = sel.filter((x) => x.T > 0).reduce((s, x) => s + x.T, 0), out = sel.filter((x) => x.T < 0).reduce((s, x) => s - x.T, 0);
    const by = (pos) => { const m = new Map(); for (const x of sel) if ((x.T > 0) === pos) { const c = x.r.kind === 'Μεταφορά' ? (pos ? 'Ανάληψη από λογαριασμό του' : 'Κατάθεση στον λογαριασμό του') : x.r.cat || '—'; m.set(c, (m.get(c) || 0) + Math.abs(x.T)); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    const yRows = yrs.map((y) => { const l = all.filter((x) => x.r.d.startsWith(y)); const i = l.filter((x) => x.T > 0).reduce((s, x) => s + x.T, 0), o = l.filter((x) => x.T < 0).reduce((s, x) => s - x.T, 0); return `<tr class="click" data-y="${y}"><td>${y}</td><td class="r pos">${eur(i)}</td><td class="r">${eur(o)}</td><td class="r">${eur(l[l.length - 1].bal)}</td></tr>`; }).join('');
    const rows = sel.slice().reverse().slice(0, 300);
    let html = '', lastM = '';
    for (const x of rows) {
      const m = x.r.d.slice(0, 7);
      if (m !== lastM) { html += `<div class="day">${MSHORT[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div>`; lastM = m; }
      const r = x.r, inn = x.T > 0;
      html += `<div class="item" data-edit="${esc(r._sp)}/${esc(r.id)}"><div class="dot">${r.kind === 'Μεταφορά' ? '⇄' : ICON[r.cat] || '•'}</div>
        <div class="grow"><div class="t">${esc(r.desc || r.cat || '')}</div><div class="s">${dShort(r.d)} · ${esc(r.kind === 'Μεταφορά' ? (inn ? 'από τον λογαριασμό του' : 'στον λογαριασμό του') : r.cat || '')}</div></div>
        <div class="right"><div class="amt ${inn ? 'pos' : ''}">${inn ? '+' : '−'}${eur(Math.abs(x.T))}</div><div class="small muted">υπόλ. ${eur(x.bal)}</div></div></div>`;
    }
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Φίλιππος</h1></div>
    <div class="card kpi"><div class="label">Χρήματα του Φιλίππου που κρατάς (ο Άλκης του χρωστάει)</div><div class="big">${eur(bal)}</div>
      <div class="small muted">= ό,τι μπήκε για εκείνον (δώρα, επιδόματα) − ό,τι ξοδεύτηκε για εκείνον</div></div>
    <div class="grid3 quick" style="margin-bottom:12px"><a class="btn green" href="#/add/inc?for=Φίλιππος">+ Μπήκαν</a><a class="btn red" href="#/add/exp?for=Φίλιππος">− Έξοδο του</a><a class="btn blue" href="#/add/trf?for=Φίλιππος">⇄ Λογαριασμός</a></div>
    <div class="chips" style="margin-bottom:10px">${[['all', 'Όλα'], ...yrs.map((y) => [y, y])].map(([v, l]) => `<button class="chip ${String(selY) === v ? 'on' : ''}" data-sy="${v}">${l}</button>`).join('')}</div>
    <div class="grid2"><div class="card kpi"><div class="label">Μπήκαν${selY === 'all' ? '' : ' ' + selY}</div><div class="mid pos">${eur(inn)}</div>
        <div class="small">${by(true).slice(0, 5).map(([c, v]) => `${ICON[c] || '•'} ${esc(c)} <b>${eur(v)}</b>`).join('<br>')}</div></div>
      <div class="card kpi"><div class="label">Ξοδεύτηκαν${selY === 'all' ? '' : ' ' + selY}</div><div class="mid">${eur(out)}</div>
        <div class="small">${by(false).slice(0, 6).map(([c, v]) => `${ICON[c] || '•'} ${esc(c)} <b>${eur(v)}</b>`).join('<br>')}</div></div></div>
    ${selY === 'all' && yrs.length ? `<div class="card"><table class="t st"><tr><th>Έτος</th><th class="r">Μπήκαν</th><th class="r">Ξοδεύτηκαν</th><th class="r">Υπόλοιπο</th></tr>${yRows}</table></div>` : ''}
    <h2>Κινήσεις</h2>
    <div class="list">${html || '<div class="item muted">Καμία κίνηση</div>'}</div>
    <div class="note small" style="margin-top:12px">Εδώ μετράνε οι κινήσεις με «Για ποιον: Φίλιππος» (έξοδα για εκείνον, δώρα και επιδόματα που πήρε) και οι μεταφορές από/προς τον λογαριασμό του. Δεν μετράνε στα δικά σας έξοδα.</div>`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/'));
    root.querySelectorAll('[data-sy]').forEach((b) => b.addEventListener('click', () => { selY = b.dataset.sy; ui.render(); }));
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { selY = b.dataset.y; ui.render(); }));
    bindEdit(root, ui);
  },
};
