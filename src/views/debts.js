// #/debts — «Οφειλές»: who owes whom (Χαρά ↔ Άλκης like Splid, Φίλιππος, other people) + pay-off plans
import { esc, eur, today } from '../util.js';
import { movements, debt } from '../ledger.js';
import { state } from '../store.js';
import * as P from '../people.js';
import * as PL from '../plan.js';
import * as O from '../office.js';
import { personSheet } from './people.js';
import { syncBadge } from '../main.js';

export default {
  live: true,
  html() {
    const d = debt(movements()); const owe = d.alkisMinusShare; const me = state.user;
    const ps = P.people().map((p) => ({ p, b: P.balance(p.id) }));
    const R = PL.room(); const gs = PL.goals();
    const row = (go, dot, name, sub, amt, cls, lab) => `<div class="item" data-go="${go}"><div class="dot">${dot}</div>
      <div class="grow"><div class="t">${esc(name)}</div><div class="s">${sub}</div></div>
      <div class="right"><div class="amt ${cls}">${amt}</div><div class="small muted">${lab}</div></div></div>`;
    return `<div class="top"><h1>Οφειλές</h1>${syncBadge()}</div>
    ${(() => { const iOwe = ps.reduce((s2, x) => s2 + (x.b < -0.005 ? -x.b : 0), 0) + (me === 'Άλκης' ? Math.max(0, -owe) : Math.max(0, owe));
      const owedMe = ps.reduce((s2, x) => s2 + (x.b > 0.005 ? x.b : 0), 0) + (me === 'Άλκης' ? Math.max(0, owe) : Math.max(0, -owe));
      const cl = O.hasOffice() ? O.clientsWithDue().reduce((s2, x) => s2 + (x.due > 0 ? x.due : 0), 0) : 0;
      return `<div class="grid2"><div class="card kpi"><div class="label">Χρωστάς συνολικά</div><div class="mid neg">${eur(iOwe)}</div>${(() => { const toOther = me === 'Άλκης' ? Math.max(0, -owe) : Math.max(0, owe); return toOther > 0.005 ? `<div class="small muted">μαζί με ${eur(toOther)} ${me === 'Άλκης' ? 'στη Χαρά' : 'στον Άλκη'}</div>` : ''; })()}${me === 'Άλκης' && d.philippos ? '<div class="small muted">χωρίς τα λεφτά του Φιλίππου</div>' : ''}</div>
        <div class="card kpi"><div class="label">Σου χρωστάνε</div><div class="mid pos">${eur(owedMe)}</div>${cl ? `<div class="small muted">+ πελάτες γραφείου ${eur(cl)}</div>` : ''}</div></div>`; })()}
    <div class="row" style="margin:0 2px 6px"><div class="grow small muted">Ποιος χρωστάει σε ποιον</div><button class="btn sm" data-new>+ Άτομο</button></div>
    <div class="list">
      ${row('#/couple', '💑', me === 'Χαρά' ? 'Άλκης' : 'Χαρά', 'κοινά, όπως στο Splid', Math.abs(owe) < 0.005 ? '✓' : eur(Math.abs(owe)), Math.abs(owe) < 0.005 ? 'muted' : me === 'Άλκης' ? (owe > 0 ? 'pos' : 'neg') : (owe > 0 ? 'neg' : 'pos'), Math.abs(owe) < 0.005 ? 'εντάξει' : owe > 0 ? 'χρωστάει η Χαρά' : 'χρωστάει ο Άλκης')}
      ${me === 'Άλκης' || Math.abs(d.philippos) > 0.005 ? row('#/philippos', '👶', 'Φίλιππος', 'τα λεφτά του που κρατάς', eur(Math.abs(d.philippos)), Math.abs(d.philippos) < 0.005 ? 'muted' : 'neg', 'του χρωστάει ο Άλκης') : ''}
      ${ps.map(({ p, b }) => row(`#/people/${esc(p.id)}`, esc(p.name.slice(0, 1)), p.name, p.plan ? `🎯 ${eur(p.plan.m)}/μήνα` : esc(p.note || ''), Math.abs(b) < 0.005 ? '✓' : eur(Math.abs(b)), b > 0.005 ? 'pos' : b < -0.005 ? 'neg' : 'muted', b > 0.005 ? 'μου χρωστάει' : b < -0.005 ? 'χρωστάω' : 'εντάξει')).join('')}
    </div>
    ${R || gs.length ? `<div class="row" style="margin:14px 2px 6px"><h2 class="grow" style="margin:0">Ξεχρέωμα & στόχοι</h2><a class="btn sm" href="#/goals">Όλα ›</a></div>
      <div class="card">${R ? R.ps.map((s) => `<div class="small" style="margin:3px 0">${esc(s.p.name)}: μένουν <b>${eur(s.debt)}</b> → τέλος ${PL.mLabel(s.end)} · ${s.due > 0.004 ? `δόση μήνα <b>${eur(s.due)}</b> ακόμα` : '<span class="pos">δόση ✓</span>'}</div>`).join('') : ''}
      ${gs.map((x) => `<div class="small" style="margin:3px 0">${esc(x.g.name)}: <b>${eur(x.saved)}</b> / ${eur(x.g.target)}</div>`).join('')}
      ${R ? `<div style="margin-top:6px;font-weight:700;color:${R.level === 'over' ? 'var(--red)' : R.level === 'warn' ? '#e0a030' : 'var(--teal)'}">${R.level === 'over' ? `⚠ Ξεπέρασες κατά ${eur(-R.free)}` : `Μπορείς να ξοδέψεις ακόμα ${eur(R.free)} αυτόν τον μήνα`}</div>` : ''}</div>` : ''}
`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelector('[data-new]')?.addEventListener('click', () => personSheet(ui, null));
  },
};
void today;
