// #/couple — Χαρά & Άλκης (like Splid): the balance and every shared movement that moved it, with the running balance
import { esc, eur, today, dShort, MSHORT } from '../util.js';
import { movements, fx } from '../ledger.js';
import { state } from '../store.js';
import { ICON } from './common.js';

let shown = 200;
export default {
  live: true,
  html() {
    const t = today(); const me = state.user; const sg = me === 'Χαρά' ? -1 : 1;     // + = the other one owes me more
    const all = movements().filter((r) => r._sp === 'shared' && r.d <= t && !r.skipped).map((r) => { const f = fx(r); return { r, e: (f.P - f.Q) * sg }; })
      .filter((x) => Math.abs(x.e) > 0.004).sort((a, b) => (a.r.d < b.r.d ? -1 : a.r.d > b.r.d ? 1 : 0));
    let run = 0; for (const x of all) { run += x.e; x.bal = run; }
    const other = me === 'Χαρά' ? 'Άλκης' : 'Χαρά';
    const head = Math.abs(run) < 0.005 ? 'Είστε εντάξει ✓' : run > 0 ? `${other === 'Χαρά' ? 'Η Χαρά σου χρωστάει' : 'Ο Άλκης σου χρωστάει'}` : `${other === 'Χαρά' ? 'Χρωστάς στη Χαρά' : 'Χρωστάς στον Άλκη'}`;
    let html = '', lastM = '';
    for (const x of all.slice().reverse().slice(0, shown)) {
      const m = x.r.d.slice(0, 7); if (m !== lastM) { html += `<div class="day">${MSHORT[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div>`; lastM = m; }
      const r = x.r; const what = r.kind === 'Μεταφορά' ? `${r.payer} → ${r.for}` : `${r.payer === 'Και οι 2' ? 'και οι 2' : r.payer}${r.for && r.for !== 'Κοινό' ? ' για ' + r.for : ''}`;
      html += `<div class="item" data-edit="${esc(r._sp)}/${esc(r.id)}"><div class="dot">${r.kind === 'Μεταφορά' ? '⇄' : ICON[r.cat] || '•'}</div>
        <div class="grow"><div class="t">${esc(r.desc || r.cat || '')}</div><div class="s">${dShort(r.d)} · ${eur(r.a)} · ${esc(what)}</div></div>
        <div class="right"><div class="amt ${x.e > 0 ? 'pos' : 'neg'}">${x.e > 0 ? '+' : '−'}${eur(Math.abs(x.e))}</div><div class="small muted">υπόλ. ${eur(x.bal)}</div></div></div>`;
    }
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Χαρά & Άλκης</h1></div>
    <div class="card kpi"><div class="label">${head}</div><div class="big ${run < -0.005 ? 'neg' : ''}">${eur(Math.abs(run))}</div></div>
    <div class="small muted" style="margin:0 4px 8px">+ = ${other === 'Χαρά' ? 'η Χαρά σου χρωστάει' : 'ο Άλκης σου χρωστάει'} περισσότερα · − = λιγότερα (ή χρωστάς εσύ). Μετράνε τα κοινά που πλήρωσε ο ένας, τα «για Χαρά / για Άλκη» και οι μεταφορές μεταξύ σας.</div>
    <div class="list">${html || '<div class="item muted">Καμία κίνηση</div>'}</div>
    ${all.length > shown ? '<div class="center" style="margin-top:10px"><button class="btn sm" data-more>Παλιότερες…</button></div>' : ''}`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.back());
    root.querySelector('[data-more]')?.addEventListener('click', () => { shown += 500; ui.render(); });
    root.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => ui.go(`#/edit/${el.dataset.edit}`)));
  },
};
