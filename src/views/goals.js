// #/goals — pay-off plans and savings goals (e.g. a 1-year safety cushion)
import { esc, eur, today, parseAmount, addMonths } from '../util.js';
import * as store from '../store.js';
import * as PL from '../plan.js';
import * as P from '../people.js';
import { sheet } from './lessons/ui.js';

const bar = (p) => `<div class="bar" style="margin-top:6px"><i style="width:${Math.round(p * 100)}%"></i></div>`;
export default {
  live: true,
  html() {
    const R = PL.room(); const ps = P.people().map((p) => PL.status(p)).filter(Boolean); const gs = PL.goals();
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Στόχοι</h1><button class="btn sm primary" data-new>+ Στόχος</button></div>
    ${R ? `<div class="card"><div class="small muted">Αυτόν τον μήνα δεσμεύονται</div><div class="mid">${eur(R.due)}</div>
      <div class="small ${R.level === 'ok' ? 'muted' : 'neg'}">μπορείς να ξοδέψεις ακόμα ${eur(Math.max(0, R.free))}${R.level === 'over' ? ` · ξεπέρασες κατά ${eur(-R.free)}` : ''}</div></div>` : ''}
    <h2>Ξεχρέωμα</h2>
    <div class="list">${ps.map((s) => `<div class="item" data-go="#/people/${esc(s.p.id)}" style="display:block"><div class="row"><b class="grow">${esc(s.p.name)}</b><span>${s.debt < 0.005 ? '✓' : eur(s.debt)}</span></div>
      <div class="small muted">${eur(s.m)}/μήνα${s.end && s.debt > 0.004 ? ` → τέλος ${PL.mLabel(s.end)}` : ''} · αυτόν τον μήνα ${s.due > 0.004 ? `μένει ${eur(s.due)}` : 'εντάξει ✓'}</div></div>`).join('') || '<div class="item muted">Κανένα — φτιάχνεται από τη σελίδα του ατόμου (Χρωστούμενα)</div>'}</div>
    <h2>Αποταμίευση</h2>
    <div class="list">${gs.map((x) => `<div class="item" data-goal="${esc(x.g.id)}" style="display:block"><div class="row"><b class="grow">${esc(x.g.name)}</b><span>${eur(x.saved)} / ${eur(x.g.target)}</span></div>${bar(x.pct)}
      <div class="small muted" style="margin-top:4px">${x.left < 0.005 ? '✓ Πέτυχε!' : `${eur(x.g.m)}/μήνα${x.end ? ` → φτάνεις ${PL.mLabel(x.end)}` : ''} · αυτόν τον μήνα ${x.due > 0.004 ? `μένουν ${eur(x.due)}` : 'εντάξει ✓'}`}</div></div>`).join('') || '<div class="item muted">Κανένας ακόμα</div>'}</div>
    <div class="note small" style="margin-top:12px">Τα λεφτά που βάζεις στην άκρη γράψ' τα ως έξοδο με κατηγορία <b>«Αποταμίευση»</b> (ή φτιάξε επαναλαμβανόμενο «Αποταμίευση» κάθε μήνα). Δεν μετράνε στα έξοδα, μετράνε στον στόχο. Η δόση κάθε στόχου «δεσμεύεται» και η αρχική σού λέει πόσα μπορείς να ξοδέψεις ακόμα.</div>`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.back());
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelector('[data-new]').addEventListener('click', () => goalSheet(ui, null));
    root.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => goalSheet(ui, store.records('goal', [PL.goalSpace()]).find((g) => g.id === b.dataset.goal))));
  },
};
function goalSheet(ui, g) {
  const cur = today().slice(0, 7); const v = (x) => (x ? String(x).replace('.', ',') : '');
  sheet(`<div class="mid">${g ? 'Στόχος' : 'Νέος στόχος αποταμίευσης'}</div>
    <label class="f" style="margin-top:10px"><span>Όνομα</span><input name="name" value="${esc(g?.name || 'Μαξιλάρι ασφαλείας')}"></label>
    <div class="grid2"><label class="f"><span>Μήνες κάλυψης</span><input name="mo" inputmode="numeric" placeholder="π.χ. 12"></label>
      <label class="f"><span>Έξοδα μήνα (€)</span><input name="pm" inputmode="decimal" placeholder="π.χ. 2000"></label></div>
    <label class="f"><span>Στόχος (€)</span><input name="target" inputmode="decimal" value="${v(g?.target)}"></label>
    <div class="grid2"><label class="f"><span>Βάζω κάθε μήνα (€)</span><input name="m" inputmode="decimal" value="${v(g?.m)}"></label>
      <label class="f"><span>Ξεκινάω από</span><input type="month" name="from" value="${esc(g?.from || cur)}"></label></div>
    <label class="f"><span>Έχω ήδη στην άκρη (€)</span><input name="start" inputmode="decimal" value="${v(g?.start)}" placeholder="0"></label>
    <div class="note small" data-prev style="margin-bottom:10px"></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>${g ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const q = (n) => el.querySelector(`[name=${n}]`); const prev = el.querySelector('[data-prev]');
    const fill = () => { const mo = parseAmount(q('mo').value), pm = parseAmount(q('pm').value); if (mo && pm) q('target').value = v(mo * pm); show(); };
    const show = () => { const t = parseAmount(q('target').value), m = parseAmount(q('m').value), st = parseAmount(q('start').value) || 0;
      if (t && m) { const n = Math.ceil(Math.max(0, t - st) / m - 1e-9); prev.innerHTML = `Με <b>${eur(m)}</b> τον μήνα φτάνεις τα <b>${eur(t)}</b> τον <b>${PL.mLabel(addMonths((q('from').value || cur) + '-01', Math.max(0, n - 1)).slice(0, 7))}</b> (${n} μήνες).`; }
      else prev.textContent = 'Γράψε στόχο και πόσα βάζεις τον μήνα.'; };
    q('mo').addEventListener('input', fill); q('pm').addEventListener('input', fill);
    ['target', 'm', 'start'].forEach((n) => q(n).addEventListener('input', show)); q('from').addEventListener('change', show); show();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del(g._sp, g.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const target = parseAmount(q('target').value), m = parseAmount(q('m').value);
      if (!target || !m) { ui.toast('Γράψε στόχο και ποσό τον μήνα'); return; }
      await store.put(g?._sp || PL.goalSpace(), g?.id || null, { type: 'goal', name: q('name').value.trim() || 'Στόχος', target, m, from: q('from').value || cur, start: parseAmount(q('start').value) || 0, cat: 'Αποταμίευση' });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}
