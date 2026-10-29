// Στατιστικά → Υπόλοιπα: Ισολογισμός (like Monefy), Χαρά ↔ Άλκης, Φίλιππος
import { esc, eur, today, parseAmount } from '../util.js';
import { movements, debt, totals } from '../ledger.js';
import * as store from '../store.js';
import * as PL from '../plan.js';
import { sheet } from './lessons/ui.js';

const balPref = () => store.records('pref', [PL.goalSpace()]).find((r) => r.id === 'bal') || { start: '2016-01-01', open: 0 };
export function balancesHtml() {
  const t = today(); const me = store.state.user; const list = movements(); const d = debt(list); const owe = d.alkisMinusShare;
  const pr = balPref(); const z = totals(list, me, pr.start, t);
  const bal = (pr.open || 0) + z.inc - z.exp;             // investments / savings are still my money: not subtracted
  return `<div class="card" data-bal style="cursor:pointer"><div class="label small muted">⚖️ Ισολογισμός από ${pr.start.split('-').reverse().join('/')}</div>
      <div class="big ${bal < 0 ? 'neg' : 'pos'}">${eur(bal)}</div>
      <div class="small muted" style="margin-top:4px">όλα τα έσοδα ${eur(z.inc)} − όλα τα έξοδα ${eur(z.exp)}${pr.open ? ` + αρχικό ${eur(pr.open)}` : ''}</div>
      ${z.save > 0.004 ? `<div class="small" style="margin-top:4px">Από αυτά <b>${eur(z.save)}</b> είναι σε επενδύσεις/αποταμίευση (δικά σου, δεν είναι έξοδο) · χωρίς αυτά: ${eur(bal - z.save)}</div>` : ''}
      <div class="small muted" style="margin-top:6px">Όπως το Monefy, αλλά οι επενδύσεις δεν μετράνε ως έξοδο. Τα χρέη που έχεις γράψει ως έξοδα (π.χ. της μαμάς) είναι ήδη μέσα. Πάτα για ημερομηνία/αρχικό ποσό.</div></div>
    <div class="grid2">
      <div class="card kpi" data-go="#/list/shared" style="cursor:pointer"><div class="label">${owe >= 0 ? 'Η Χαρά χρωστάει στον Άλκη' : 'Ο Άλκης χρωστάει στη Χαρά'}</div><div class="big ${owe >= 0 ? '' : 'neg'}">${eur(Math.abs(owe))}</div></div>
      <div class="card kpi" data-go="#/philippos" style="cursor:pointer"><div class="label">Ο Άλκης χρωστάει στον Φίλιππο</div><div class="big">${eur(d.philippos)}</div></div>
    </div>
    <div class="grid2"><a class="btn" href="#/people">🤝 Χρωστούμενα</a><a class="btn" href="#/goals">🎯 Στόχοι</a></div>`;
}
export function balancesMount(root, ui) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
  root.querySelector('[data-bal]')?.addEventListener('click', () => {
    const pr = balPref();
    sheet(`<div class="mid">⚖️ Ισολογισμός</div><div class="small muted">Όλα σου τα έσοδα μείον όλα σου τα έξοδα (το μερίδιό σου) από μια ημερομηνία.</div>
      <div class="grid2" style="margin-top:10px"><label class="f"><span>Από</span><input type="date" name="start" value="${esc(pr.start)}"></label>
      <label class="f"><span>Αρχικό ποσό (€)</span><input name="open" inputmode="decimal" value="${esc(pr.open ? String(pr.open).replace('.', ',') : '')}" placeholder="0"></label></div>
      <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
      el.querySelector('[data-no]').onclick = close;
      el.querySelector('[data-ok]').onclick = async () => { await store.put(PL.goalSpace(), 'bal', { type: 'pref', start: el.querySelector('[name=start]').value || '2016-01-01', open: parseAmount(el.querySelector('[name=open]').value) || 0 }); close(); };
    });
  });
}
