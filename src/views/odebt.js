// #/odebt/<who> — «Γραφείο Χαράς ↔ Άλκης»: office expenses someone paid «το χρωστάει το γραφείο» and the office's repayments
import { esc, eur, today, dFull } from '../util.js';
import { state } from '../store.js';
import * as store from '../store.js';
import * as O from '../office.js';
import { syncBadge } from '../main.js';
import { movements } from '../ledger.js';

/** expenses marked «🏢 for the office» that were paid by `who` but still count between Άλκης and Χαρά */
function candidates(who) {
  const t = today(); const out = [];
  for (const r of store.records('tx', ['shared'])) if (r.ofc && !r.ooff && r.kind === 'Έξοδο' && r.payer === who) out.push({ sp: r._sp, id: r.id, name: r.desc || r.cat, d: r.d, sum: r.a || 0 });
  const occ = movements().filter((r) => r.rec && r.ofc && !r.skipped && r.d <= t && r.payer === who);
  for (const def of store.records('rec', ['shared'])) if (def.ofc && !def.ooff && def.kind === 'Έξοδο' && def.payer === who) {
    const l = occ.filter((r) => r.rec === def.id); out.push({ sp: def._sp, id: def.id, name: def.name, rec: true, n: l.length, sum: l.reduce((s, r) => s + (r.a || 0), 0) });
  }
  return out;
}
export default {
  live: true,
  html([who]) {
    const me = state.user; who = who ? decodeURIComponent(who) : me === 'Χαρά' ? 'Άλκης' : me;
    const x = O.officeDebts().find((d) => d.who === who) || { spent: 0, paid: 0, owed: 0, items: [], reps: [] };
    const all = x.items.map((r) => ({ d: r.d, a: r.a || 0, r, k: 'e' })).concat(x.reps.map((r) => ({ d: r.d, a: -(r.a || 0), r, k: 'p' }))).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    let run = 0; for (const m of all) { run += m.a; m.bal = run; }
    const cand = candidates(who);
    const isMe = who === me, toW = who === 'Άλκης' ? 'στον Άλκη' : 'σε ' + who;
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>🏢 Healthy Project ↔ ${esc(who)}</h1>${syncBadge()}</div>
    <div class="card center"><div class="small muted">${isMe ? 'Σου χρωστάει το γραφείο της Χαράς' : `Το γραφείο χρωστάει ${esc(toW)}`}</div>
      <div class="mid ${x.owed > 0.004 ? (isMe ? 'pos' : 'neg') : 'muted'}" style="font-size:26px">${x.owed > 0.004 ? eur(x.owed) : '✓ εντάξει'}</div>
      <div class="small muted" style="margin-top:4px">έξοδα για το γραφείο ${eur(x.spent)} · επιστροφές ${eur(x.paid)}</div>
      ${me === 'Χαρά' && x.owed > 0.004 ? `<button class="btn primary" style="margin-top:10px" data-repay>Τον πλήρωσα</button>` : ''}</div>
    <div class="small muted" style="margin:4px 4px 6px">Όλες οι κινήσεις (νεότερες πάνω) · δίπλα το υπόλοιπο μετά από κάθε μία</div>
    <div class="list">${all.slice().reverse().map((m) => m.k === 'e'
      ? `<div class="item" data-go="#/edit/${esc(m.r._sp)}/${encodeURIComponent(m.r.id)}"><div class="dot">🧾</div><div class="grow"><div class="t">${esc(m.r.desc || m.r.cat || '')}</div><div class="s">${dFull(m.d)} · πλήρωσε ${esc(who)} για το γραφείο${m.r.inv ? ' · 📑 τιμολόγιο' : ''}${m.r.rec ? ' · ↻' : ''}</div></div>
        <div class="right"><div class="amt">+${eur(m.a)}</div><div class="small muted">υπόλ. ${eur(m.bal)}</div></div></div>`
      : `<div class="item" data-rep="${esc(m.r.id)}"><div class="dot">↩</div><div class="grow"><div class="t">Επιστροφή από το γραφείο</div><div class="s">${dFull(m.d)}</div></div>
        <div class="right"><div class="amt pos">−${eur(-m.a)}</div><div class="small muted">υπόλ. ${eur(m.bal)}</div></div></div>`).join('') || '<div class="item muted">Καμία κίνηση ακόμα</div>'}</div>
    ${cand.length ? `<h2>Έξοδα για το γραφείο που τα χρωστάει ακόμα η Χαρά</h2><div class="small muted" style="margin:-4px 4px 6px">Έχουν «🏢 Έξοδο του γραφείου» αλλά μετράνε στο Χαρά–Άλκης. Πάτα «→ Γραφείο» για να τα χρωστάει το Healthy Project.</div>
      <div class="list">${cand.map((c) => `<div class="item"><div class="dot">${c.rec ? '↻' : '🧾'}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${c.rec ? `επαναλαμβανόμενο · ${c.n} φορές ως τώρα (όλες μαζί)` : dFull(c.d)}</div></div>
        <div class="right"><div class="amt">${eur(c.sum)}</div><button class="btn sm" data-conv="${esc(c.sp)}|${esc(c.id)}" style="margin-top:4px">→ Γραφείο</button></div></div>`).join('')}</div>
      ${cand.length > 1 ? '<button class="btn" style="width:100%;margin-top:8px" data-convall>Όλα → Γραφείο</button>' : ''}` : ''}
    <div class="small muted" style="margin:8px 4px">Μπαίνουν εδώ τα έξοδα με «🏢 Έξοδο του γραφείου της Χαράς» + «Το χρωστάει το γραφείο». Δεν μετράνε στο Χαρά–Άλκης.</div>`;
  },
  mount(root, [who], ui) {
    who = who ? decodeURIComponent(who) : state.user === 'Χαρά' ? 'Άλκης' : state.user;
    root.querySelector('[data-back]').addEventListener('click', () => ui.back());
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelector('[data-repay]')?.addEventListener('click', () => window.__repaySheet?.(who));
    const conv = async (k) => { const [sp, id] = k.split('|'); await store.put(sp, id, { ooff: 1 }); };
    root.querySelectorAll('[data-conv]').forEach((b) => b.addEventListener('click', () => conv(b.dataset.conv)));
    root.querySelector('[data-convall]')?.addEventListener('click', async () => { for (const b of root.querySelectorAll('[data-conv]')) await conv(b.dataset.conv); });
    root.querySelectorAll('[data-rep]').forEach((b) => b.addEventListener('click', async () => {
      if (state.user !== 'Χαρά') return;
      if (!(await ui.confirm('Να σβηστεί αυτή η επιστροφή;', 'Διαγραφή'))) return;
      await store.del('shared', b.dataset.rep);
    }));
  },
};
