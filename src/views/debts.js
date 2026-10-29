// #/debts — «Οφειλές»: who owes whom (Χαρά ↔ Άλκης like Splid, Φίλιππος, other people) + pay-off plans
import { esc, eur, today } from '../util.js';
import { movements, debt } from '../ledger.js';
import { state } from '../store.js';
import * as P from '../people.js';
import * as PL from '../plan.js';
import { personSheet } from './people.js';
import { syncBadge } from '../main.js';

export default {
  live: true,
  html() {
    const d = debt(movements()); const owe = d.alkisMinusShare; const me = state.user;
    const ps = P.people().map((p) => ({ p, b: P.balance(p.id) }));
    const R = PL.room(); const gs = PL.goals();
    const settle = owe >= 0 ? `payer=${encodeURIComponent('Χαρά')}&for=${encodeURIComponent('Άλκης')}` : `payer=${encodeURIComponent('Άλκης')}&for=${encodeURIComponent('Χαρά')}`;
    return `<div class="top"><h1>Οφειλές</h1>${syncBadge()}</div>
    <div class="small muted" style="margin:-6px 4px 10px">Ποιος χρωστάει σε ποιον</div>
    <div class="card" data-go="#/list/shared" style="cursor:pointer"><div class="row"><span class="dot">💑</span><div class="grow"><div class="small muted">Χαρά & Άλκης (κοινά)</div>
      <div class="mid">${Math.abs(owe) < 0.005 ? 'Είστε εντάξει ✓' : owe > 0 ? `Η Χαρά χρωστάει στον Άλκη <b>${eur(owe)}</b>` : `Ο Άλκης χρωστάει στη Χαρά <b>${eur(-owe)}</b>`}</div></div><span class="muted">›</span></div>
      ${Math.abs(owe) >= 0.005 ? `<a class="btn sm" style="margin-top:8px" href="#/add/trf?${settle}&a=${String(Math.round(Math.abs(owe) * 100) / 100).replace('.', ',')}" data-stop>⇄ Ξεχρέωση (μεταφορά)</a>` : ''}</div>
    ${me === 'Άλκης' || d.philippos ? `<div class="card" data-go="#/philippos" style="cursor:pointer"><div class="row"><span class="dot">👶</span><div class="grow"><div class="small muted">Φίλιππος (τα λεφτά του που κρατάς)</div>
      <div class="mid">Ο Άλκης χρωστάει στον Φίλιππο <b>${eur(d.philippos)}</b></div></div><span class="muted">›</span></div></div>` : ''}
    <div class="row" style="margin:14px 2px 6px"><h2 class="grow" style="margin:0">Με άλλους</h2><button class="btn sm" data-new>+ Άτομο</button></div>
    <div class="list">${ps.map(({ p, b }) => `<div class="item" data-go="#/people/${esc(p.id)}"><div class="dot">${esc(p.name.slice(0, 1))}</div>
      <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${p.plan ? `🎯 ${eur(p.plan.m)}/μήνα` : esc(p.note || '')}</div></div>
      <div class="right"><div class="amt ${b > 0.005 ? 'pos' : b < -0.005 ? 'neg' : 'muted'}">${Math.abs(b) < 0.005 ? '✓' : eur(Math.abs(b))}</div><div class="small muted">${b > 0.005 ? 'μου χρωστάει' : b < -0.005 ? 'χρωστάω' : 'εντάξει'}</div></div></div>`).join('') || '<div class="item muted">Κανένα άτομο ακόμα</div>'}</div>
    ${R || gs.length ? `<div class="row" style="margin:14px 2px 6px"><h2 class="grow" style="margin:0">Ξεχρέωμα & στόχοι</h2><a class="btn sm" href="#/goals">Όλα ›</a></div>
      <div class="card">${R ? R.ps.map((s) => `<div class="small" style="margin:3px 0">${esc(s.p.name)}: μένουν <b>${eur(s.debt)}</b> → τέλος ${PL.mLabel(s.end)} · ${s.due > 0.004 ? `δόση μήνα <b>${eur(s.due)}</b> ακόμα` : '<span class="pos">δόση ✓</span>'}</div>`).join('') : ''}
      ${gs.map((x) => `<div class="small" style="margin:3px 0">${esc(x.g.name)}: <b>${eur(x.saved)}</b> / ${eur(x.g.target)}</div>`).join('')}
      ${R ? `<div style="margin-top:6px;font-weight:700;color:${R.level === 'over' ? 'var(--red)' : R.level === 'warn' ? '#e0a030' : 'var(--teal)'}">${R.level === 'over' ? `⚠ Ξεπέρασες κατά ${eur(-R.free)}` : `Μπορείς να ξοδέψεις ακόμα ${eur(R.free)} αυτόν τον μήνα`}</div>` : ''}</div>` : ''}
    <div class="note small" style="margin-top:12px">Χαρά & Άλκης: ό,τι κοινό πληρώνει ο ένας (όπως στο Splid). Με άλλους: αδερφή, μαμά, φίλοι — από τα έξοδα με «+ Άλλοι» ή με τα κουμπιά στη σελίδα του καθενός.</div>`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => { if (e.target.closest('[data-stop]')) return; ui.go(b.dataset.go); }));
    root.querySelector('[data-new]')?.addEventListener('click', () => personSheet(ui, null));
  },
};
void today;
