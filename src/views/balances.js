// Στατιστικά → Υπόλοιπα: Ισολογισμός (like Monefy), Χαρά ↔ Άλκης, Φίλιππος
import { esc, eur, today, parseAmount } from '../util.js';
import { movements, debt, totals, SAVE } from '../ledger.js';
import { norm } from '../util.js';
import * as store from '../store.js';
import * as PL from '../plan.js';
import { sheet } from './lessons/ui.js';

const balPref = () => store.records('pref', [PL.goalSpace()]).find((r) => r.id === 'bal') || { start: '2016-01-01', open: 0 };
const looksSaving = (t) => /αποταμιευσ|επενδυσ|\betf\b/.test(norm(t));
function misbooked() {
  const tx = store.records('tx').filter((r) => r.kind === 'Έξοδο' && !SAVE.has(r.cat) && r.d >= '2025-01-01' && looksSaving(r.desc) && store.state.data[r._sp]?.recs.has(r.id));
  const rec = store.records('rec').filter((r) => r.kind === 'Έξοδο' && !SAVE.has(r.cat) && looksSaving(r.name));
  return { tx, rec, sum: tx.reduce((s, r) => s + (r.a || 0), 0) };
}
export function balancesHtml() {
  const mb = misbooked();
  const fix = mb.tx.length + mb.rec.length ? `<div class="card" style="border-left:4px solid #e0a030"><b>Βρέθηκαν ${mb.tx.length} κινήσεις «Αποταμίευση/Επενδύσεις» (${eur(mb.sum)})${mb.rec.length ? ` και ${mb.rec.length} επαναλαμβανόμενο` : ''} σε κατηγορία που μετράει ως έξοδο.</b>
      <div class="small muted" style="margin:4px 0 8px">Αν είναι τα λεφτά που βάζεις σε ETF, να γίνουν κατηγορία «Επενδύσεις» (δεν μετράνε στα έξοδα);</div>
      <button class="btn primary sm" data-fixsave>Ναι, να γίνουν Επενδύσεις</button></div>` : '';
  const t = today(); const me = store.state.user; const list = movements(); const d = debt(list); const owe = d.alkisMinusShare;
  const pr = balPref(); const z = totals(list, me, pr.start, t);
  const bal = (pr.open || 0) + z.inc - z.exp;             // investments / savings are still my money: not subtracted
  return `${fix}<div class="card" data-bal style="cursor:pointer"><div class="label small muted">⚖️ Ισολογισμός από ${pr.start.split('-').reverse().join('/')}</div>
      <div class="big ${bal < 0 ? 'neg' : 'pos'}">${eur(bal)}</div>
      <div class="small muted" style="margin-top:4px">όλα τα έσοδα ${eur(z.inc)} − όλα τα έξοδα ${eur(z.exp)}${pr.open ? ` + αρχικό ${eur(pr.open)}` : ''}</div>
      ${z.inv > 0.004 || z.sav > 0.004 ? `<div class="small" style="margin-top:4px">${z.inv > 0.004 ? `📈 Επενδύσεις: <b>${eur(z.inv)}</b>` : ''}${z.inv > 0.004 && z.sav > 0.004 ? ' · ' : ''}${z.sav > 0.004 ? `🐷 Αποταμίευση: <b>${eur(z.sav)}</b>` : ''}</div>` : ''}
      <div class="small muted" style="margin-top:6px">Πάτα για ημερομηνία / αρχικό ποσό.</div></div>
`;
}
export function balancesMount(root, ui) {
  root.querySelector('[data-fixsave]')?.addEventListener('click', async () => {
    const mb = misbooked(); const by = new Map();
    for (const r of [...mb.tx, ...mb.rec]) { if (!by.has(r._sp)) by.set(r._sp, []); by.get(r._sp).push({ id: r.id, set: { cat: 'Επενδύσεις' } }); }
    for (const [sp, ch] of by) await store.putMany(sp, ch);
    ui.toast(`${mb.tx.length + mb.rec.length} αλλαγές ✓`);
  });
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
