// #/people — money with other people (Splid-like): balances, entries, settle up
import { esc, eur, today, dFull, parseAmount } from '../util.js';
import * as store from '../store.js';
import * as P from '../people.js';
import { sheet } from './lessons/ui.js';

import * as PL from '../plan.js';
import { addMonths } from '../util.js';
/** «Ο Γιώργος» / «Η Ευανθία»; with dative: «Του» / «Της» */
const g = (p, dat) => { const m = /ς$/.test(p.name.trim()) && !/&/.test(p.name); return dat ? (/&/.test(p.name) ? 'Τους' : m ? 'Του' : 'Της') : (/&/.test(p.name) ? 'Οι ' + p.name : (m ? 'Ο ' : 'Η ') + p.name); };
function planHtml(p) {
  const b = P.balance(p.id); if (b > -0.005 && !p.plan) return '';
  const s = PL.status(p);
  if (!s) return `<button class="btn" style="width:100%;margin-bottom:12px" data-plan>🎯 Πλάνο ξεχρεώματος (πόσα τον μήνα, πότε τελειώνω)</button>`;
  return `<div class="card" data-plan style="cursor:pointer;border-left:4px solid var(--teal)"><div class="row"><b class="grow">🎯 Πλάνο: ${eur(s.m)} τον μήνα</b><span class="small" style="color:var(--teal)">Αλλαγή ›</span></div>
    <div class="small" style="margin-top:4px">${s.debt < 0.005 ? '✓ Ξεχρεώθηκε!' : `Τελειώνεις <b>${PL.mLabel(s.end)}</b> (${s.months} ${s.months === 1 ? 'δόση' : 'δόσεις'})${s.later ? ` · ξεκινά ${PL.mLabel(s.later)}` : ` · αυτόν τον μήνα: ${s.due > 0.004 ? `μένει ${eur(s.due)}` : 'δόθηκε ✓'}`}`}</div>
    ${s.buffer ? `<div class="small muted">Να μένουν πάντα τουλάχιστον ${eur(s.buffer)} για απρόβλεπτα</div>` : ''}</div>`;
}
function planSheet(ui, p) {
  const debt = Math.max(0, -P.balance(p.id)); const cur = today().slice(0, 7); const pl = p.plan || {};
  sheet(`<div class="mid">🎯 Πλάνο ξεχρεώματος · ${esc(p.name)}</div><div class="small muted">Χρωστάς ${eur(debt)}. Γράψε ή πόσα τον μήνα ή μέχρι πότε — το άλλο βγαίνει μόνο του.</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Πόσα τον μήνα (€)</span><input name="m" inputmode="decimal" value="${esc(pl.m ? String(pl.m).replace('.', ',') : '')}"></label>
      <label class="f"><span>Να τελειώσω (μήνας)</span><input type="month" name="end" value=""></label></div>
    <label class="f"><span>Ξεκινάω από</span><input type="month" name="from" value="${esc(pl.from || cur)}"></label>
    <label class="f"><span>Να μένουν πάντα για απρόβλεπτα (€, προαιρετικά)</span><input name="buf" inputmode="decimal" value="${esc(pl.buffer ? String(pl.buffer).replace('.', ',') : '')}" placeholder="π.χ. 200"></label>
    <div class="note small" data-prev style="margin-bottom:10px"></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>${p.plan ? '<button class="btn" data-del style="color:var(--red)">Χωρίς πλάνο</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const M = el.querySelector('[name=m]'), E = el.querySelector('[name=end]'), F = el.querySelector('[name=from]'), prev = el.querySelector('[data-prev]');
    const months = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5)) - Number(a.slice(5)) + 1;
    const show = () => { const m = parseAmount(M.value); const from = F.value || cur;
      if (m > 0) { const n = Math.ceil(debt / m - 1e-9); prev.innerHTML = `Με <b>${eur(m)}</b> τον μήνα τελειώνεις <b>${PL.mLabel(addMonths(from + '-01', n - 1).slice(0, 7))}</b> (${n} δόσεις). Η δόση «δεσμεύεται» κάθε μήνα και η αρχική σού λέει πόσα μπορείς να ξοδέψεις ακόμα.`; }
      else prev.textContent = 'Γράψε ποσό ή μήνα που θέλεις να τελειώσεις.'; };
    E.addEventListener('change', () => { if (!E.value) return; const n = Math.max(1, months(F.value || cur, E.value)); M.value = String(Math.ceil((debt / n) * 100) / 100).replace('.', ','); show(); });
    M.addEventListener('input', show); F.addEventListener('change', show); show();
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.put(p._sp, p.id, { plan: null }); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const m = parseAmount(M.value); if (!(m > 0)) { ui.toast('Γράψε πόσα τον μήνα'); return; }
      await store.put(p._sp, p.id, { plan: { m, from: F.value || cur, buffer: parseAmount(el.querySelector('[name=buf]').value) || 0 } }); close(); ui.toast('Το πλάνο μπήκε ✓');
    };
  });
}
const balTxt = (b) => (Math.abs(b) < 0.005 ? 'εντάξει' : b > 0 ? `μου χρωστάει ${eur(b)}` : `του/της χρωστάω ${eur(-b)}`);
const listView = {
  html() {
    const ps = P.people().map((p) => ({ p, b: P.balance(p.id) }));
    const owed = ps.reduce((s, x) => s + (x.b > 0.005 ? x.b : 0), 0), owe = ps.reduce((s, x) => s + (x.b < -0.005 ? -x.b : 0), 0);
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Χρωστούμενα</h1><button class="btn sm primary" data-new>+ Άτομο</button></div>
    <div class="grid2"><div class="card kpi"><div class="label">Μου χρωστάνε</div><div class="mid pos">${eur(owed)}</div></div>
      <div class="card kpi"><div class="label">Χρωστάω</div><div class="mid neg">${eur(owe)}</div></div></div>
    <div class="list">${ps.map(({ p, b }) => `<div class="item" data-go="#/people/${esc(p.id)}"><div class="dot">${esc(p.name.slice(0, 1))}</div>
      <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.note || '')}</div></div>
      <div class="right"><div class="amt ${b > 0.005 ? 'pos' : b < -0.005 ? 'neg' : 'muted'}">${Math.abs(b) < 0.005 ? '✓' : eur(Math.abs(b))}</div><div class="small muted">${b > 0.005 ? 'μου χρωστάει' : b < -0.005 ? 'χρωστάω' : 'εντάξει'}</div></div></div>`).join('') || '<div class="item muted">Κανένα άτομο ακόμα</div>'}</div>
    <div class="note small" style="margin-top:12px">Για λογαριασμούς που μοιράζεσαι με άλλους (π.χ. Spotify με την οικογένεια της αδερφής σου): στο έξοδο ή στο επαναλαμβανόμενο → «Περισσότερα» → «Μέρος το χρωστάει άλλος». Στα δικά σου έξοδα μετράει μόνο το δικό σου μέρος και εδώ μαζεύεται τι σου χρωστάνε. Όταν σου δώσουν χρήματα: «Μου έδωσε».
    <br>Τα βλέπεις μόνο εσύ.</div>`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/debts'));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelector('[data-new]').addEventListener('click', () => personSheet(ui, null));
  },
};
const detail = {
  html([id]) {
    const p = P.person(id); if (!p) return '<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Δεν βρέθηκε</h1></div>';
    const es = P.entries(id); const b = es.reduce((s, e) => s + e.a, 0);
    // running balance (oldest → newest) and totals of debts / money given back
    let run = 0; es.slice().reverse().forEach((e) => { run += e.a; e.bal = run; });
    const isPay = (e) => e.m && (e.m.k === 'got' || e.m.k === 'gave' || e.m.k === 'set');
    const debtsSum = es.filter((e) => !isPay(e)).reduce((s, e) => s + Math.abs(e.a), 0), paysSum = es.filter(isPay).reduce((s, e) => s + Math.abs(e.a), 0);
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${esc(p.name)}</h1><button class="btn sm" data-edit>Επεξεργασία</button></div>
    <div class="card kpi"><div class="label">${Math.abs(b) < 0.005 ? 'Είστε εντάξει' : b > 0 ? 'Σου χρωστάει' : `${g(p, 1)} χρωστάς`}</div><div class="big ${b > 0.005 ? 'pos' : b < -0.005 ? 'neg' : ''}">${eur(Math.abs(b))}</div></div>
    ${es.length > 1 && !p.bill ? `<div class="grid2"><div class="card kpi"><div class="label">📝 Χρέη συνολικά</div><div class="mid">${eur(debtsSum)}</div><div class="small muted">${es.filter((e) => !isPay(e)).length} καταχωρήσεις</div></div>
      <div class="card kpi"><div class="label">💶 Επιστράφηκαν</div><div class="mid">${eur(paysSum)}</div><div class="small muted">${es.filter(isPay).length} πληρωμές</div></div></div>` : ''}
    ${planHtml(p)}
    <div class="small muted" style="margin:2px 4px 6px">💶 Δόθηκαν λεφτά (ξεχρεώνει):</div>
    <div class="grid2 quick" style="margin-bottom:10px"><button class="btn green" data-k="got">${g(p)} μου έδωσε</button><button class="btn" data-k="gave">${g(p, 1)} έδωσα</button></div>
    <div class="small muted" style="margin:2px 4px 6px">📝 Νέο χρέος (χωρίς να δοθούν λεφτά):</div>
    <div class="grid2" style="margin-bottom:${p.bill ? 6 : 12}px"><button class="btn sm" data-k="owesme">+ Μου χρωστάει</button><button class="btn sm" data-k="iowe">+ ${g(p, 1)} χρωστάω</button></div>
    ${p.bill ? '<button class="btn sm" style="width:100%;margin-bottom:12px" data-k="set">🧾 Νέο υπόλοιπο από λογαριασμό</button>' : ''}
    <div class="list">${es.map((e) => `<div class="item" ${e.m ? `data-m="${esc(e.m.id)}"` : `data-tx="${esc(e.tx._sp)}/${esc(e.tx.id)}"`}><div class="dot">${e.m ? (e.m.k === 'got' || e.m.k === 'gave' ? '💶' : '📝') : e.tx.rec ? '↻' : '🧾'}</div>
      <div class="grow"><div class="t">${esc(e.setTo != null && !e.m.note ? "Από λογαριασμό" : e.what)}</div><div class="s">${dFull(e.d)}${e.setTo != null ? ` · διαφορά ${e.a >= 0 ? '+' : '−'}${eur(Math.abs(e.a))}` : e.m ? ' · ' + esc((P.KINDS[e.m.k]?.label || '').replace('Του/της', g(p, 1).toLowerCase())) : ''}</div></div>
      <div class="right"><div class="amt ${e.setTo != null ? (e.setTo >= 0 ? 'pos' : 'neg') : e.a > 0 ? 'pos' : 'neg'}">${e.setTo != null ? `= ${eur(Math.abs(e.setTo))}` : `${e.a > 0 ? '+' : '−'}${eur(Math.abs(e.a))}`}</div><div class="small muted">υπόλ. ${eur(Math.abs(e.bal))}</div></div></div>`).join('') || '<div class="item muted">Τίποτα ακόμα</div>'}</div>
    <div class="small muted" style="margin-top:6px">Όλο το ιστορικό, νεότερα πάνω · 📝 = χρέος · 💶 = πληρωμή · υπόλ. = πόσα έμεναν μετά από αυτή την κίνηση · πάτα μια γραμμή για αλλαγή</div>`;
  },
  mount(root, [id], ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.back());
    root.querySelector('[data-edit]')?.addEventListener('click', () => personSheet(ui, P.person(id)));
    root.querySelector('[data-plan]')?.addEventListener('click', () => planSheet(ui, P.person(id)));
    root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => movSheet(ui, id, b.dataset.k, null)));
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { const m = store.records('pmov').find((x) => x.id === b.dataset.m); movSheet(ui, id, m.k, m); }));
    root.querySelectorAll('[data-tx]').forEach((b) => b.addEventListener('click', () => ui.go(`#/edit/${b.dataset.tx}`)));
  },
};
function movSheet(ui, pid, k, m) {
  const K = P.KINDS[k]; const p = P.person(pid); const b = P.balance(pid);
  const ps = k === 'gave' && !m ? PL.status(p) : null;
  const sugg = ps && ps.due > 0.004 ? String(Math.round(ps.due * 100) / 100).replace('.', ',') : !m && ((k === 'got' && b > 0.005) || (k === 'gave' && b < -0.005)) ? String(Math.round(Math.abs(b) * 100) / 100).replace('.', ',') : '';
  sheet(`<div class="mid">${esc(K.label.replace('Του/της', p.name.endsWith('ς') ? 'Του' : 'Της'))} · ${esc(p.name)}</div><div class="small muted">${esc(K.hint)}</div>
    ${k === 'set' ? `<div class="seg" data-sgn style="margin-top:10px"><button type="button" data-val="1" class="${(m?.sign || 1) > 0 ? 'on' : ''}">Μας χρωστάει</button><button type="button" data-val="-1" class="${(m?.sign || 1) < 0 ? 'on' : ''}">Του χρωστάμε</button></div>` : ''}
    <input class="amount" name="a" inputmode="decimal" style="margin-top:10px" value="${esc(m ? String(m.a).replace('.', ',') : sugg)}" placeholder="0,00 €">
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${esc(m?.d || today())}"></label>
    <label class="f"><span>Τι (προαιρετικά)</span><input name="note" value="${esc(m?.note || '')}" placeholder="π.χ. 1ο τρίμηνο 2026"></label></div>
    <button class="btn primary" data-ok>Αποθήκευση</button>${m ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    let sign = m?.sign || 1;
    el.querySelectorAll('[data-sgn] button').forEach((b) => b.addEventListener('click', () => { sign = Number(b.dataset.val); el.querySelectorAll('[data-sgn] button').forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del(m._sp, m.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const a = parseAmount(el.querySelector('[name=a]').value); if (!a && !(k === 'set' && a === 0)) { ui.toast('Γράψε ποσό'); return; }
      await store.put(m?._sp || p._sp || P.peopleSpace(), m?.id || null, { type: 'pmov', p: pid, k, a: Math.abs(a), sign: k === 'set' ? (a < 0 ? -sign : sign) : null, d: el.querySelector('[name=d]').value || today(), note: el.querySelector('[name=note]').value.trim() || null });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
  setTimeout(() => document.querySelector('.sheet [name=a]')?.focus(), 50);
}
export function personSheet(ui, p) {
  sheet(`<div class="mid">${p ? 'Επεξεργασία' : 'Νέο άτομο'}</div>
    <label class="f" style="margin-top:10px"><span>Όνομα</span><input name="name" value="${esc(p?.name || '')}" placeholder="π.χ. Μαμά, Αδερφή, Σοφία (νονά)"></label>
    <label class="f"><span>Σημείωση</span><input name="note" value="${esc(p?.note || '')}"></label>
    <label class="row small" style="margin:0 2px 8px"><input type="checkbox" name="sh" style="width:auto" ${p?._sp === 'shared' ? 'checked' : ''}> <span>👫 Κοινό — το βλέπει και ${store.state.user === 'Χαρά' ? 'ο Άλκης' : 'η Χαρά'}</span></label>
    <label class="row small" style="margin:0 2px 12px"><input type="checkbox" name="bill" style="width:auto" ${p?.bill ? 'checked' : ''}> <span>🧾 Υπόλοιπο από λογαριασμό (π.χ. κοινόχρηστα: γράφεις κάθε φορά το υπόλοιπο που λέει ο λογαριασμός)</span></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${p ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (Math.abs(P.balance(p.id)) > 0.005) { ui.toast('Έχει ανοιχτό υπόλοιπο'); return; }
      await store.del(p._sp, p.id); close(); ui.go('#/people');
    });
    el.querySelector('[data-ok]').onclick = async () => {
      const name = el.querySelector('[name=name]').value.trim(); if (!name) return;
      const sh = el.querySelector('[name=sh]').checked; const sp = sh ? 'shared' : P.peopleSpace();
      const fields = { type: 'person', name, note: el.querySelector('[name=note]').value.trim() || null, bill: el.querySelector('[name=bill]').checked ? 1 : null };
      if (p && p._sp !== sp) {                     // moved between personal and shared: the person and its entries go together
        const nid = await store.put(sp, null, { ...fields, plan: p.plan || null });
        const movs = store.records('pmov').filter((m) => m.p === p.id);
        for (const m of movs) { const { id: _i, _t, _u, _m, _x, _sp, ...f } = m; await store.put(sp, null, { ...f, p: nid }); await store.del(m._sp, m.id); }
        await store.del(p._sp, p.id); close(); ui.go(`#/people/${nid}`); return;
      }
      const id = await store.put(p?._sp || sp, p?.id || null, fields);
      close(); if (!p) ui.go(`#/people/${id}`);
    };
  });
}
export default {
  live: true,
  html(p, ui) { return (p[0] ? detail : listView).html(p, ui); },
  mount(root, p, ui) { (p[0] ? detail : listView).mount(root, p, ui); },
};
