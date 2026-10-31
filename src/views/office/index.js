// #/office… — Γραφείο της Χαράς: home, client payments, office expenses, clients, partners, statistics, fixed costs
import { esc, eur, today, dShort, dFull, MONTHS, MSHORT, parseAmount, norm, addMonths } from '../../util.js';
import * as store from '../../store.js';
import * as O from '../../office.js';
import { syncBadge } from '../../main.js';
import { sheet } from '../lessons/ui.js';
import { entryView } from './entry.js';

const k0 = (x) => `${Math.round(x || 0).toLocaleString('el-GR')} €`;
let cmpM = 'inc';
const back = (h) => `<button class="btn sm ghost" data-back="${h || ''}">‹</button>`;
const bindCommon = (root, ui) => {
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => (b.dataset.back ? ui.go(b.dataset.back) : ui.back())));
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
  root.querySelectorAll('[data-pfee]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); pfeeSheet(); }));
};
/** the office pays back someone who paid office expenses (a shared record, so the other side sees it too) */
window.__repaySheet = (who) => repaySheet(who);
function repaySheet(who) {
  const x = O.officeDebts().find((d) => d.who === who); if (!x) return;
  sheet(`<div class="mid">Επιστροφή ${who === 'Άλκης' ? 'στον Άλκη' : 'σε ' + esc(who)}</div><div class="small muted">Το γραφείο του χρωστάει ${eur(x.owed)}. Δεν είναι έξοδο (το έξοδο μετρήθηκε ήδη), απλώς βγαίνουν τα χρήματα από το γραφείο.</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ποσό (€)</span><input name="a" inputmode="decimal" value="${String(x.owed).replace('.', ',')}"></label><label class="f"><span>Ημερομηνία</span><input type="date" name="d" value="${today()}"></label></div>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => { const a = parseAmount(el.querySelector('[name=a]').value); if (!a) return; await store.put('shared', null, { type: 'orep', d: el.querySelector('[name=d]').value || today(), a, to: who }); close(); };
  });
}
const pctS = (x) => (x ? String(Math.round(x * 10000) / 100).replace('.', ',') : '');
/** commission rates per payment method: % of the amount and/or a fixed € per payment */
function pfeeSheet() {
  const F = O.payFees(), H = O.payFeeHistory();
  const desc = (R) => Object.entries(R).map(([k, v]) => `${esc(k)} ${pctS(v.p) || 0}%${v.f ? ` + ${String(v.f).replace('.', ',')} €` : ''}`).join(' · ') || 'καμία προμήθεια';
  sheet(`<div class="mid">Προμήθειες κάρτας / IRIS</div><div class="small muted">Ό,τι κρατάει η τράπεζα σε κάθε πληρωμή. Μπαίνει μόνο του στα έξοδα του γραφείου, ένα ποσό τον μήνα για κάθε τρόπο («${O.COMM_CAT}»). Άδειο = καμία προμήθεια.</div>
    <label class="f" style="margin-top:10px"><span>Ισχύει για πληρωμές από</span><input type="date" name="from" value="${today()}"></label>
    <div class="small muted" style="margin:-4px 2px 4px">Οι πληρωμές πριν από αυτή την ημερομηνία κρατάνε τις χρεώσεις που ίσχυαν τότε.</div>
    <table class="t" style="margin:10px 0"><tr><th></th><th>% στο ποσό</th><th>+ € ανά πληρωμή</th></tr>
    ${O.FEE_PAYS.map((k) => `<tr><td>${esc(k)}</td><td><input data-p="${esc(k)}" inputmode="decimal" value="${pctS(F[k]?.p)}" placeholder="${k === 'POS' ? '1,2' : k === 'IRIS' ? '0,5' : '—'}" style="width:80px;padding:6px 8px"></td><td><input data-f="${esc(k)}" inputmode="decimal" value="${F[k]?.f ? String(F[k].f).replace('.', ',') : ''}" placeholder="0" style="width:70px;padding:6px 8px"></td></tr>`).join('')}</table>
    ${H.length ? `<div class="small" style="margin:0 2px 12px"><b>Ιστορικό</b>${H.slice().reverse().map((x, i) => `<div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span style="flex:1">${x.from <= '2000-01-01' ? 'από την αρχή' : 'από ' + dFull(x.from)}: ${desc(x.rates)}</span><button class="btn sm ghost" data-delh="${esc(x.from)}" style="color:var(--red);width:auto;flex:none;margin:0">✕</button></div>`).join('')}</div>` : ''}
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelectorAll('[data-delh]').forEach((b) => b.addEventListener('click', async () => { await store.put(O.OSP, 'office', { type: 'opref', pfh: H.filter((x) => x.from !== b.dataset.delh), pfee: null }); close(); }));
    el.querySelector('[data-ok]').onclick = async () => {
      const out = {}; const from = el.querySelector('[name=from]').value || today();
      for (const k of O.FEE_PAYS) { const p = (parseAmount(el.querySelector(`[data-p="${k}"]`).value) || 0) / 100, f = parseAmount(el.querySelector(`[data-f="${k}"]`).value) || 0; if (p || f) out[k] = { p, f }; }
      await store.put(O.OSP, 'office', { type: 'opref', pfh: H.filter((x) => x.from !== from).concat([{ from, rates: out }]), pfee: null }); close();
    };
  });
}
const payRow = (r) => `<div class="item" data-go="#/office/in/${esc(r.id)}"><div class="dot">💶</div>
  <div class="grow"><div class="t">${esc(r.cl || '—')}</div><div class="s">${dShort(r.d)} · ${esc(r.svc || '')}${r.pay ? ' · ' + esc(r.pay) : ''}${r.part ? ' · 🤝 ' + esc(O.partner(r.part)?.name || '') : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
  <div class="right"><div class="amt pos">+${eur(r.a)}</div>${r.due ? `<div class="small ${r.due > 0 ? 'pos' : 'neg'}">${r.due > 0 ? 'χρωστάει' : 'του χρωστάς'} ${eur(Math.abs(r.due))}</div>` : ''}${r.rcpt ? '<div class="small muted">🧾 απόδειξη</div>' : ''}</div></div>`;
const expRow = (r) => r.comm ? `<div class="item" data-pfee style="cursor:pointer"><div class="dot">💳</div>
  <div class="grow"><div class="t">${esc(r.desc)}</div><div class="s">${dShort(r.d)} · ${esc(r.cat)} · υπολογίζεται μόνο του</div></div><div class="amt">−${eur(r.a)}</div></div>` : `<div class="item" data-go="${r.sal ? `#/rec/${esc(r._sp)}/${esc(r.rec)}` : r.rec || r.ext ? `#/edit/${esc(r._sp)}/${encodeURIComponent(r.id)}` : `#/office/ex/${esc(r.id)}`}"><div class="dot">${r.sal ? '👩‍⚕️' : r.ext ? '🏠' : r.rec ? '↻' : '🧾'}</div>
  <div class="grow"><div class="t">${esc(r.desc || r.cat || '')}</div><div class="s">${dShort(r.d)} · ${esc(r.cat || '')}${r.part ? ' · 🤝 ' + esc(O.partner(r.part)?.name || '') : ''}${r.pay ? ' · ' + esc(r.pay) : ''}${r.ooff ? ' · το χρωστάει το γραφείο' : ''}</div></div>
  <div class="right"><div class="amt">−${eur(r.a)}</div>${r.inv ? `<div class="small muted">📑 τιμολόγιο · ΦΠΑ ${eur(O.invVat(r))}</div>` : ''}</div></div>`;

let monthOff = 0;
const L = (period, f) => `#/office/list/${period}/${encodeURIComponent(f)}`;
const home = {
  html() {
    const t = today(); const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + monthOff);
    const m = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
    const z = O.monthTotals(m); const ly = O.totals(`${Number(m.slice(0, 4)) - 1}${m.slice(4)}-01`, `${Number(m.slice(0, 4)) - 1}${m.slice(4)}-${monthOff === 0 ? t.slice(8) : '31'}`);
    const owed = O.partners().map((p) => ({ p, ...O.partnerStatus(p.id) })).filter((x) => Math.abs(x.owed) > 0.004);
    const recent = O.incomes().slice(0, 8);
    const upcoming = O.expenses(true).filter((r) => r.d > t && r.d <= addMonths(t, 1).slice(0, 10)).reverse().slice(0, 6);
    const dues = O.clientsWithDue().sort((a, b) => b.due - a.due);
    const odebts = O.officeDebts().filter((x) => x.owed > 0.004);
    return `<div class="top"><h1>Γραφείο</h1>${syncBadge()}</div>
    <span class="ac" style="margin-bottom:10px"><input type="search" name="find" placeholder="🔍 Πελάτης (όνομα)" autocomplete="off"><span class="ac-list" data-ac hidden></span></span>
    <div class="grid2 quick" style="margin-bottom:12px"><a class="btn green" href="#/office/in/new">+ Έσοδο γραφείου</a><a class="btn red" href="#/office/ex/new">− Έξοδο γραφείου</a></div>
    <div class="card">
      <div class="row"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}${monthOff === 0 ? ' <span class="small muted">ως σήμερα</span>' : ''}</div>
        <button class="btn sm ghost" data-m="1" ${monthOff >= 0 ? 'disabled' : ''}>▶</button></div>
      <div class="grid3 center" style="margin-top:10px">
        <div data-go="${L(m, 'in')}" style="cursor:pointer"><div class="small muted">Έσοδα ›</div><div class="mid pos">${eur(z.inc)}</div></div>
        <div data-go="${L(m, 'ex')}" style="cursor:pointer"><div class="small muted">Έξοδα ›</div><div class="mid neg">${eur(z.exp)}</div></div>
        <div data-go="#/office/list/${m}" style="cursor:pointer"><div class="small muted">Κέρδος ›</div><div class="mid ${z.inc - z.exp < 0 ? 'neg' : 'pos'}">${eur(z.inc - z.exp)}</div></div></div>
      <div class="small muted center" style="margin-top:6px">Κέρδος = έσοδα − έξοδα του μήνα (πριν τον μισθό σου) · πέρσι τον ίδιο μήνα: ${eur(ly.inc - ly.exp)}</div>
      <details style="margin-top:8px"><summary class="small" style="cursor:pointer;text-align:center">Λεπτομέρειες μήνα</summary>
        <div class="small" style="margin-top:6px;line-height:1.7">
          <div class="row"><span class="grow">Πληρωμές πελατών</span><b>${z.n}</b></div>
          <div class="row"><span class="grow"><a href="${L(m, 'rcpt')}">Από αυτές με απόδειξη</a></span><b>${eur(z.rcpt)}</b></div>
          <div class="row"><span class="grow">Έσοδα χωρίς τον ΦΠΑ</span><b>${eur(z.net)}</b></div>
          <div class="row"><span class="grow">ΦΠΑ αποδείξεων (<span data-vatset style="text-decoration:underline;cursor:pointer">${String(Math.round(O.vatRate() * 1000) / 10).replace('.', ',')}%</span>)</span><b>${eur(z.vat)}</b></div>
          ${z.ninv ? `<div class="row"><span class="grow"><a href="${L(m, 'inv')}">Αγορές με τιμολόγιο</a> · ΦΠΑ ${eur(z.ivat)}</span><b>${eur(z.inv)}</b></div>` : ''}
          ${z.fee ? `<div class="row"><span class="grow">Αμοιβές συνεργατών (μέσα στα έξοδα)</span><b>${eur(z.fee)}</b></div>` : ''}
          ${z.disc ? `<div class="row"><span class="grow">Εκπτώσεις σε πελάτες συνεργατών</span><b>${eur(z.disc)}</b></div>` : ''}
          <div class="row"><span class="grow"><span data-pfee style="text-decoration:underline;cursor:pointer">Προμήθειες κάρτας / IRIS</span></span><b>${eur(z.byCat.get(O.COMM_CAT) || 0)}</b></div>
          <div class="row"><span class="grow">Μισθός σου</span><b>${eur(z.sal)}</b></div>
          <div class="row"><span class="grow">Μένουν στο γραφείο (κέρδος − μισθός)</span><b class="${z.res < 0 ? 'neg' : 'pos'}">${eur(z.res)}</b></div>
          <div class="row muted"><span class="grow">Ίδιος μήνας πέρσι</span><span>έσοδα ${eur(ly.inc)} · έξοδα ${eur(ly.exp)}</span></div>
        </div></details></div>
    ${dues.length ? `<div class="card"><b>Εκκρεμότητες πελατών</b>
      ${dues.filter((x) => x.due > 0).length ? `<div class="small" style="margin-top:4px">Σου χρωστάνε <b class="pos">${eur(dues.filter((x) => x.due > 0).reduce((s, x) => s + x.due, 0))}</b>: ${dues.filter((x) => x.due > 0).map((x) => `<a href="#/office/c/${encodeURIComponent(x.name)}">${esc(x.name)}</a> ${eur(x.due)}`).join(' · ')}</div>` : ''}
      ${dues.filter((x) => x.due < 0).length ? `<div class="small" style="margin-top:4px">Χρωστάς <b class="neg">${eur(-dues.filter((x) => x.due < 0).reduce((s, x) => s + x.due, 0))}</b>: ${dues.filter((x) => x.due < 0).map((x) => `<a href="#/office/c/${encodeURIComponent(x.name)}">${esc(x.name)}</a> ${eur(-x.due)}`).join(' · ')}</div>` : ''}</div>` : ''}
    ${odebts.length || owed.length ? `<div class="card small">${odebts.map((x) => `<div><a href="#/odebt/${encodeURIComponent(x.who)}">Το γραφείο χρωστάει ${x.who === 'Άλκης' ? 'στον Άλκη' : 'σε ' + esc(x.who)} <b class="neg">${eur(x.owed)}</b> ›</a></div>`).join('')}${owed.length ? `<div><a href="#/office/partners">Χρωστάς σε συνεργάτες: ${owed.map((x) => `${esc(x.p.name)} <b class="neg">${eur(x.owed)}</b>`).join(' · ')} ›</a></div>` : ''}</div>` : ''}
    <h2>Τελευταίες πληρωμές</h2>
    <div class="list">${recent.map(payRow).join('') || '<div class="item muted">Καμία ακόμα</div>'}</div>
    ${upcoming.length ? `<h2>Έρχονται (30 μέρες)</h2><div class="list">${upcoming.map(expRow).join('')}</div>` : ''}`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { monthOff = Math.min(0, monthOff + Number(b.dataset.m)); ui.render(); }));
    const fi = root.querySelector('[name=find]'), box = root.querySelector('[data-ac]');
    const showF = () => { const q = norm(fi.value).trim(); if (!q) { box.hidden = true; return; }
      const hits = O.clients().filter((c) => norm(c.name).includes(q)).sort((a, b) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1) || (a.last < b.last ? 1 : -1)).slice(0, 8);
      box.innerHTML = hits.map((c) => `<button type="button" data-acv="${esc(c.name)}"><b>${esc(c.name)}</b><span class="small muted">${c.n ? `${c.n}× · ${dFull(c.last)}` : 'χωρίς πληρωμές ακόμα'}</span></button>`).join('') || '<button type="button" disabled><span class="muted">Κανένας πελάτης</span></button>'; box.hidden = false; };
    fi.addEventListener('input', showF); fi.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    box.addEventListener('pointerdown', (e) => e.preventDefault());
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-acv]'); if (b) ui.go(`#/office/c/${encodeURIComponent(b.dataset.acv)}`); });
    fi.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; const b = box.querySelector('[data-acv]'); if (b) ui.go(`#/office/c/${encodeURIComponent(b.dataset.acv)}`); });
    root.querySelector('[data-vatset]')?.addEventListener('click', () => sheet(`<div class="mid">ΦΠΑ στις αποδείξεις</div><div class="small muted">Ισχύει για τις νέες πληρωμές με απόδειξη (οι παλιές κρατάνε το ποσοστό που είχαν).</div>
      <label class="f" style="margin-top:10px"><span>Ποσοστό ΦΠΑ (%)</span><input name="v" inputmode="decimal" value="${String(Math.round(O.vatRate() * 1000) / 10).replace('.', ',')}"></label>
      <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
      el.querySelector('[data-no]').onclick = close;
      el.querySelector('[data-ok]').onclick = async () => { const v = parseAmount(el.querySelector('[name=v]').value); if (v == null) return; await store.put(O.OSP, 'office', { type: 'opref', vat: v / 100 }); close(); };
    }));
  },
};
function salarySheet(ui) {
  const s = O.salaryDef();
  if (s) { ui.go(`#/rec/${s._sp}/${s.id}`); return; }
  sheet(`<div class="mid">👩‍⚕️ Μισθός Χαράς</div><div class="small muted">Κάθε μήνα βγαίνει από το γραφείο (έξοδο) και μπαίνει στα προσωπικά σου (έσοδο «Μισθός»). Αλλαγές ποσού αργότερα: πατάς ξανά εδώ.</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ποσό τον μήνα (€)</span><input name="a" inputmode="decimal" placeholder="π.χ. 2000"></label>
    <label class="f"><span>Πρώτη φορά</span><input type="date" name="start" value="${today()}"></label></div>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const a = parseAmount(el.querySelector('[name=a]').value); if (!a) { ui.toast('Γράψε ποσό'); return; }
      await store.put(O.OSP, null, { type: 'rec', name: O.SAL_NAME, a, cat: 'Μισθός', kind: 'Έσοδο', payer: 'Χαρά', for: '', unit: 'm', every: 1, start: el.querySelector('[name=start]').value || today(), salary: 1 });
      close(); ui.toast('Ο μισθός μπήκε ✓');
    };
  });
}
function goalSheet(ui) {
  const pr = O.pref(); const v = (x) => (x ? String(x).replace('.', ',') : '');
  sheet(`<div class="mid">🏢 Υπόλοιπο γραφείου</div><div class="small muted">Γράψε πόσα έχει πραγματικά το γραφείο (λογαριασμός + μετρητά) μια μέρα. Από εκεί και πέρα προσθέτει τα έσοδα και αφαιρεί τα έξοδα και τον μισθό σου.</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Πραγματικό υπόλοιπο (€)</span><input name="open" inputmode="decimal" value="${v(pr.open)}" placeholder="π.χ. 1500"></label>
    <label class="f"><span>Στις</span><input type="date" name="asOf" value="${esc(pr.asOf || today())}"></label></div>
    <label class="f"><span>Στόχος μαξιλαριού γραφείου (€)</span><input name="goal" inputmode="decimal" value="${v(pr.goal)}" placeholder="π.χ. 3 × πάγια μήνα"></label>
    <div class="small muted" style="margin-bottom:10px">Πάγια γραφείου τον μήνα: ${eur(O.fixed().reduce((s, x) => s + (x.m || 0), 0))} — συνήθως μαξιλάρι = 3–6 μήνες πάγια.</div>
    <button class="btn primary" data-ok>Αποθήκευση</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => { const open = el.querySelector('[name=open]').value.trim(); await store.put(O.OSP, 'office', { type: 'opref', goal: parseAmount(el.querySelector('[name=goal]').value) || 0, open: parseAmount(open) || 0, asOf: open ? el.querySelector('[name=asOf]').value || today() : null }); close(); };
  });
}

let listQ = '';
const list = {
  html([arg]) {
    const sl = (arg || '').indexOf('/'); let m = sl < 0 ? arg : arg.slice(0, sl); const flt = sl < 0 ? '' : arg.slice(sl + 1);
    m = m || today().slice(0, 7); const isY = m.length === 4;
    const n = norm(listQ).trim();
    const F = O.filtered(n ? '' : m, flt);
    const inc = n ? O.incomes(true).filter((r) => norm(`${r.cl} ${r.svc} ${r.note || ''} ${r.pay || ''}`).includes(n)) : F.inc;
    const exp = n ? O.expenses(true).filter((r) => norm(`${r.desc} ${r.cat} ${r.note || ''}`).includes(n)) : F.exp;
    const all = [...inc.map((r) => ({ r, k: 'in' })), ...exp.map((r) => ({ r, k: 'ex' }))].sort((a, b) => (a.r.d < b.r.d ? 1 : -1));
    const si = inc.reduce((s, r) => s + (r.a || 0), 0), se = exp.reduce((s, r) => s + (r.a || 0), 0);
    let html = '', last = '';
    for (const { r, k } of all.slice(0, 400)) { if (r.d !== last) { html += `<div class="day">${dShort(r.d)}${n ? ' ' + r.d.slice(0, 4) : ''}</div>`; last = r.d; } html += k === 'in' ? payRow(r) : expRow(r); }
    const [y, mo] = m.split('-').map(Number); const nav = (d) => (isY ? String(y + d) : addMonths(`${m}-01`, d).slice(0, 7)) + (flt ? '/' + flt : '');
    return `<div class="top">${back('#/office')}<h1>Κινήσεις γραφείου</h1></div>
    <input type="search" name="q" placeholder="🔍 Πελάτης, υπηρεσία, έξοδο…" value="${esc(listQ)}" style="margin-bottom:10px">
    ${n ? '' : `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-mm="${esc(nav(-1))}">◀</button><div class="grow center mid">${isY ? y : `${MONTHS[mo - 1]} ${y}`}</div><button class="btn sm ghost" data-mm="${esc(nav(1))}">▶</button></div>`}
    ${flt && !n ? `<div class="note row" style="margin-bottom:8px"><span class="grow">${esc(O.FILTER_LABEL(flt))}</span><button class="btn sm ghost" data-mm="${esc(m)}">✕</button></div>` : ''}
    <div class="card grid3 center" style="padding:10px 6px;margin-bottom:8px"><div><div class="small muted">Έσοδα</div><b class="pos">${eur(si)}</b></div><div><div class="small muted">Έξοδα</div><b class="neg">${eur(se)}</b></div><div><div class="small muted">Διαφορά</div><b class="${si - se < 0 ? 'neg' : 'pos'}">${eur(si - se)}</b></div></div>
    <div class="list">${html || '<div class="item muted">Καμία κίνηση</div>'}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => ui.go(`#/office/list/${encodeURI(b.dataset.mm)}`)));
    const qi = root.querySelector('[name=q]');
    qi.addEventListener('input', () => { listQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const x = document.querySelector('[name=q]'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); });
  },
};

let clQ = '';
const clientsView = {
  html() {
    const n = norm(clQ).trim(); const t = today();
    const all = O.clients(); const cs = all.filter((c) => !n || norm(c.name).includes(n) || (c.card?.phone || '').includes(n)).sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : a.name.localeCompare(b.name, 'el')));
    const act = cs.filter((c) => c.last && c.last >= addMonths(t, -2)); const noPay = all.filter((c) => !c.n).length;
    return `<div class="top">${back('#/office')}<h1>Πελάτες</h1><button class="btn sm primary" data-newcl>+ Πελάτης</button></div>
    <input type="search" name="q" placeholder="🔍 Όνομα ή τηλέφωνο" value="${esc(clQ)}" style="margin-bottom:8px">
    <div class="small muted" style="margin:0 4px 8px">${cs.length} πελάτες · ${act.length} με επίσκεψη τους τελευταίους 2 μήνες${noPay && !n ? ` · ${noPay} χωρίς πληρωμές (από τη λίστα πελατών)` : ''}</div>
    <div class="list">${cs.slice(0, 300).map((c) => `<div class="item" data-go="#/office/c/${encodeURIComponent(c.name)}"><div class="dot">${esc(c.name.slice(0, 1))}</div>
      <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${c.n ? `${c.n} ${c.n === 1 ? 'πληρωμή' : 'πληρωμές'} · τελευταία ${dFull(c.last)}${c.lastSvc ? ' · ' + esc(c.lastSvc) : ''}` : `ανενεργός${c.card?.phone ? ' · ' + esc(c.card.phone) : ''}`}</div></div>
      <div class="amt ${c.n ? '' : 'muted'}">${c.n ? eur(c.sum) : '—'}</div></div>`).join('') || '<div class="item muted">Κανένας</div>'}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelector('[data-newcl]').addEventListener('click', () => clientSheet(ui, null, clQ));
    const qi = root.querySelector('[name=q]');
    qi.addEventListener('input', () => { clQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const x = document.querySelector('[name=q]'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); });
  },
};
const clientView = {
  html([name]) {
    const ps = O.clientPays(name); const sum = ps.reduce((s, r) => s + (r.a || 0), 0); const due = O.clientDue(name); const cd = O.clientCard(name);
    return `<div class="top">${back()}<h1>${esc(name)}</h1><button class="btn sm" data-card>${cd ? 'Στοιχεία' : '+ Στοιχεία'}</button></div>
    ${(() => { const s = O.clientSource(name); return s ? `<div class="small muted" style="margin:-4px 4px 8px">Σε έμαθε από: <b>${esc(O.srcLabel(s))}</b>${s.set ? '' : ' (από τις πληρωμές του)'}</div>` : '<div class="small muted" style="margin:-4px 4px 8px">Από πού σε έμαθε: — (πάτα «Στοιχεία»)</div>'; })()}
    ${cd && (cd.phone || cd.email || cd.note) ? `<div class="card small">${cd.phone ? `📞 <a href="tel:${esc(cd.phone.replace(/[^\d+]/g, ''))}">${esc(cd.phone)}</a>` : ''}${cd.phone && cd.email ? ' · ' : ''}${cd.email ? `✉️ <a href="mailto:${esc(cd.email)}">${esc(cd.email)}</a>` : ''}${cd.note ? `<div class="muted" style="margin-top:4px">${esc(cd.note)}</div>` : ''}</div>` : ''}
    ${due ? `<div class="card kpi"><div class="label">${due > 0 ? 'Σου χρωστάει' : 'Του/της χρωστάς'}</div><div class="big ${due > 0 ? 'pos' : 'neg'}">${eur(Math.abs(due))}</div><div class="small muted">από την τελευταία πληρωμή — διορθώνεται εκεί</div></div>` : ''}
    <div class="grid3"><div class="card kpi"><div class="label">Σύνολο</div><div class="mid">${eur(sum)}</div></div>
      <div class="card kpi"><div class="label">Πληρωμές</div><div class="mid">${ps.length}</div></div>
      <div class="card kpi"><div class="label">Από</div><div class="mid">${ps.length ? dFull(ps[ps.length - 1].d) : '—'}</div></div></div>
    <a class="btn green" style="width:100%;margin-bottom:12px" href="#/office/in/new?cl=${encodeURIComponent(name)}">+ Έσοδο από ${esc(name.split(' ')[0])}</a>
    <div class="list">${ps.map(payRow).join('')}</div>`;
  },
  mount(root, [name], ui) { bindCommon(root, ui); root.querySelector('[data-card]').addEventListener('click', () => clientSheet(ui, O.clientCard(decodeURIComponent(name)), decodeURIComponent(name))); },
};
/** a client's card: name, phone, e-mail, note (renaming the card does not touch past payments) */
function clientSheet(ui, c, name = '') {
  sheet(`<div class="mid">${c ? 'Στοιχεία πελάτη' : 'Νέος πελάτης'}</div>
    <label class="f" style="margin-top:10px"><span>Ονοματεπώνυμο</span><input name="name" value="${esc(c?.name || name || '')}"></label>
    <div class="grid2"><label class="f"><span>Κινητό</span><input name="phone" inputmode="tel" value="${esc(c?.phone || '')}"></label><label class="f"><span>E-mail</span><input name="email" inputmode="email" value="${esc(c?.email || '')}"></label></div>
    ${(() => { const cur = c?.src ? { src: c.src, part: c.srcPart } : (name ? O.clientSource(name) : null); const parts = O.partners();
      return `<label class="f"><span>Από πού σε έμαθε</span><select name="src"><option value=""></option>${O.SRCS.map((x) => `<option ${cur?.src === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label class="f" data-srcpart style="${cur?.src === 'Συνεργαζόμενος χώρος' ? '' : 'display:none'}"><span>Ποιος συνεργαζόμενος χώρος</span><select name="srcPart"><option value=""></option>${parts.map((x) => `<option value="${esc(x.id)}" ${cur?.part === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`; })()}
    <label class="f"><span>Σημείωση</span><input name="note" value="${esc(c?.note || '')}"></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${c ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή στοιχείων</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del(c._sp, c.id); close(); });
    el.querySelector('[name=src]').addEventListener('change', (e) => { el.querySelector('[data-srcpart]').style.display = e.target.value === 'Συνεργαζόμενος χώρος' ? '' : 'none'; });
    el.querySelector('[data-ok]').onclick = async () => {
      const v = (k) => el.querySelector(`[name=${k}]`).value.trim() || null; const nm = v('name'); if (!nm) return;
      await store.put(O.OSP, c?.id || null, { type: 'ocl', name: nm, phone: v('phone'), email: v('email'), note: v('note'), src: v('src'), srcPart: v('src') === 'Συνεργαζόμενος χώρος' ? v('srcPart') : null }); close();
      if (!c) ui.go(`#/office/c/${encodeURIComponent(nm)}`);
    };
  });
}

const partnersView = {
  html() {
    const ps = O.partners();
    return `<div class="top">${back('#/office')}<h1>Συνεργάτες</h1><button class="btn sm primary" data-new>+ Συνεργάτης</button></div>
    <div class="small muted" style="margin:-4px 4px 10px">Χώροι που σου στέλνουν πελάτες (π.χ. Nadi). Για τον καθένα ορίζεις αν παίρνει αμοιβή (ποσοστό ανά πελάτη/ραντεβού) και αν ο πελάτης του έχει έκπτωση.</div>
    <div class="list">${ps.map((p) => { const s = O.partnerStatus(p.id); return `<div class="item" style="display:block;${p.active === false ? 'opacity:.6' : ''}">
      <div class="row" data-edit="${esc(p.id)}" style="cursor:pointer"><div class="grow"><div class="t">${esc(p.name)} <span class="small muted">· ${p.pct ? `αμοιβή ${fmtPct(p.pct)}` : 'χωρίς αμοιβή'}${p.disc ? ` · έκπτωση πελάτη ${Math.round(p.disc * 100)}%` : ''}${p.active === false ? ' · ανενεργός' : ''}</span></div>
        <div class="s">${s.n} πελάτες${s.fees || s.paid ? ` · αμοιβές ${eur(s.fees)} · πληρώθηκαν ${eur(s.paid)}` : ''}</div></div>
        <div class="right"><div class="amt ${s.owed > 0.004 ? 'neg' : 'muted'}">${s.owed > 0.004 ? eur(s.owed) : '✓'}</div><div class="small muted">${s.owed > 0.004 ? 'τους χρωστάς' : 'εντάξει'}</div></div></div>
      ${s.owed > 0.004 ? `<button class="btn sm" style="margin-top:8px" data-pay="${esc(p.id)}">Πλήρωσα ${esc(p.name)}</button>` : ''}</div>`; }).join('') || '<div class="item muted">Κανένας ακόμα</div>'}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelector('[data-new]').addEventListener('click', () => partnerSheet(ui, null));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => partnerSheet(ui, O.partner(b.dataset.edit))));
    root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => { const s = O.partnerStatus(b.dataset.pay); ui.go(`#/office/ex/new?part=${b.dataset.pay}&a=${String(Math.round(s.owed * 100) / 100).replace('.', ',')}`); }));
  },
};
const fmtPct = (x) => { const p = (x || 0) * 100; return Math.abs(p - 100 / 3) < 0.01 ? '⅓ (33,3%)' : `${String(Math.round(p * 10) / 10).replace('.', ',')}%`; };
function partnerSheet(ui, p) {
  sheet(`<div class="mid">${p ? 'Συνεργάτης' : 'Νέος συνεργάτης'}</div>
    <label class="f" style="margin-top:10px"><span>Όνομα</span><input name="name" value="${esc(p?.name || '')}" placeholder="π.χ. Nadi"></label>
    <label class="f"><span>Αμοιβή συνεργασίας (ποσοστό)</span><input name="pct" value="${p ? (Math.abs((p.pct || 0) - 1 / 3) < 1e-6 ? '1/3' : String(Math.round((p.pct || 0) * 1000) / 10).replace('.', ',') + '%') : '0%'}" placeholder="0% = χωρίς αμοιβή · π.χ. 20% ή 1/3"></label>
    <label class="f"><span>Έκπτωση στον πελάτη που έρχεται από εκεί (%)</span><input name="disc" inputmode="decimal" value="${p ? (p.disc ? String(Math.round(p.disc * 1000) / 10).replace('.', ',') : '') : '15'}" placeholder="π.χ. 15 — άδειο = καμία"></label>
    <label class="row small" style="margin:0 2px 12px"><input type="checkbox" name="active" style="width:auto" ${p?.active === false ? '' : 'checked'}> Ενεργός (εμφανίζεται στις πληρωμές)</label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${p ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (O.partnerStatus(p.id).n) { ui.toast('Έχει πληρωμές — κάν’ τον ανενεργό'); return; }
      await store.del(p._sp, p.id); close();
    });
    el.querySelector('[data-ok]').onclick = async () => {
      const name = el.querySelector('[name=name]').value.trim(); if (!name) return;
      const raw = el.querySelector('[name=pct]').value.trim(); let pct = parseAmount(raw.replace('%', '')) || 0; if (raw.endsWith('%') || pct > 1) pct /= 100;
      const dsc = (parseAmount(el.querySelector('[name=disc]').value.replace('%', '')) || 0) / 100;
      await store.put(p?._sp || O.OSP, p?.id || null, { type: 'opart', name, pct, disc: dsc || null, active: el.querySelector('[name=active]').checked });
      close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}

let statY = null;
const statsView = {
  html() {
    const t = today(); statY = statY || Number(t.slice(0, 4));
    const ms = O.months(statY); const rows = ms.map((m) => ({ m, ...O.monthTotals(m) }));
    const Y = O.totals(`${statY}-01-01`, `${statY}-12-31`);
    const n = Math.max(1, ms.length); const hasSal = Y.sal > 0.004;
    const sv = [...Y.bySvc.entries()].sort((a, b) => b[1] - a[1]); const ct = [...Y.byCat.entries()].sort((a, b) => b[1] - a[1]); const pm = [...Y.byPay.entries()].sort((a, b) => b[1] - a[1]);
    const top = O.clients().map((c) => ({ ...c, y: O.clientPays(c.name).filter((r) => r.d.startsWith(String(statY))).reduce((s, r) => s + (r.a || 0), 0) })).filter((c) => c.y > 0).sort((a, b) => b.y - a.y).slice(0, 10);
    const parts = O.partners().map((p) => ({ p, v: O.incomes().filter((r) => r.part === p.id && r.d.startsWith(String(statY))).reduce((s, r) => s + (r.fee || 0), 0) })).filter((x) => x.v > 0.004);
    const bar = (l, tot, fk) => l.map(([k, v]) => `<div style="margin:6px 0;cursor:pointer" data-go="${L(statY, `${fk}:${k}`)}"><div class="row"><span class="grow">${esc(k)}</span><b>${eur(v)}</b><span class="small muted" style="width:44px;text-align:right">${tot ? Math.round((v / tot) * 100) : 0}%</span></div><div class="bar" style="margin-top:3px"><i style="width:${tot ? Math.round((v / l[0][1]) * 100) : 0}%"></i></div></div>`).join('');
    return `<div class="top">${back('#/office')}<h1>Στατιστικά γραφείου</h1></div>
    <div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-y="-1">◀</button><div class="grow center mid">${statY}</div><button class="btn sm ghost" data-y="1" ${statY >= Number(t.slice(0, 4)) ? 'disabled' : ''}>▶</button></div>
    <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Μήνας</th><th class="r">Έσοδα</th><th class="r">🧾</th><th class="r">Καθαρά</th><th class="r">Έξοδα</th>${hasSal ? '<th class="r">Μισθός</th>' : ''}<th class="r">Μένουν</th></tr>
      ${rows.slice().reverse().map((r) => `<tr class="click"><td data-go="#/office/list/${r.m}">${MSHORT[Number(r.m.slice(5)) - 1]}</td><td class="r pos" data-go="${L(r.m, 'in')}">${k0(r.inc)}</td><td class="r muted" data-go="${L(r.m, 'rcpt')}">${k0(r.rcpt)}</td><td class="r" data-go="${L(r.m, 'in')}">${k0(r.net)}</td><td class="r" data-go="${L(r.m, 'ex')}">${k0(r.exp)}</td>${hasSal ? `<td class="r" data-go="${L(r.m, 'sal')}">${k0(r.sal)}</td>` : ''}<td class="r ${r.res < 0 ? 'neg' : 'pos'}" data-go="#/office/list/${r.m}">${k0(r.res)}</td></tr>`).join('')}
      <tr class="tot click"><td data-go="#/office/list/${statY}">Σύνολο</td><td class="r" data-go="${L(statY, 'in')}">${k0(Y.inc)}</td><td class="r" data-go="${L(statY, 'rcpt')}">${k0(Y.rcpt)}</td><td class="r">${k0(Y.net)}</td><td class="r" data-go="${L(statY, 'ex')}">${k0(Y.exp)}</td>${hasSal ? `<td class="r">${k0(Y.sal)}</td>` : ''}<td class="r">${k0(Y.res)}</td></tr>
      <tr><td>Μ.Ο.</td><td class="r">${k0(Y.inc / n)}</td><td class="r">${k0(Y.rcpt / n)}</td><td class="r">${k0(Y.net / n)}</td><td class="r">${k0(Y.exp / n)}</td>${hasSal ? `<td class="r">${k0(Y.sal / n)}</td>` : ''}<td class="r">${k0(Y.res / n)}</td></tr></table>
      <div class="small muted" style="margin-top:6px">🧾 = με απόδειξη · Μένουν = έσοδα − έξοδα − μισθός · Καθαρά = χωρίς τον ΦΠΑ των αποδείξεων (χωρίς απόδειξη = όλο) · ΦΠΑ χρονιάς ${eur(Y.vat)}${Y.disc ? ` · εκπτώσεις συνεργασιών ${eur(Y.disc)}` : ''} · πάτα όποιο νούμερο για τις κινήσεις του</div></div>
    ${Y.ninv || Y.vat ? (() => { const q = [1, 2, 3, 4].map((i) => { const ms3 = rows.filter((r) => Math.ceil(Number(r.m.slice(5)) / 3) === i); return { i, inv: ms3.reduce((s, r) => s + r.inv, 0), ivat: ms3.reduce((s, r) => s + r.ivat, 0), vat: ms3.reduce((s, r) => s + r.vat, 0), n: ms3.length }; }).filter((x) => x.n);
      return `<h2>ΦΠΑ: αποδείξεις & τιμολόγια</h2><div class="card" style="overflow-x:auto"><table class="t st"><tr><th></th><th class="r">ΦΠΑ εκρ.</th><th class="r">Τιμολ.</th><th class="r">ΦΠΑ εισρ.</th><th class="r">Διαφ.</th></tr>
      ${rows.slice().reverse().filter((r) => r.vat || r.ninv).map((r) => `<tr class="click" data-go="${L(r.m, 'inv')}"><td>${MSHORT[Number(r.m.slice(5)) - 1]}</td><td class="r">${k0(r.vat)}</td><td class="r">${k0(r.inv)}</td><td class="r">${k0(r.ivat)}</td><td class="r">${k0(r.vat - r.ivat)}</td></tr>`).join('')}
      ${q.map((x) => `<tr class="tot"><td>${x.i}ο τρίμ.</td><td class="r">${k0(x.vat)}</td><td class="r">${k0(x.inv)}</td><td class="r">${k0(x.ivat)}</td><td class="r">${k0(x.vat - x.ivat)}</td></tr>`).join('')}
      <tr class="tot click" data-go="${L(statY, 'inv')}"><td>${statY}</td><td class="r">${k0(Y.vat)}</td><td class="r">${k0(Y.inv)}</td><td class="r">${k0(Y.ivat)}</td><td class="r">${k0(Y.vat - Y.ivat)}</td></tr></table>
      <div class="small muted" style="margin-top:6px">ΦΠΑ εκρ. = ΦΠΑ των αποδείξεων, ό,τι χρέωσες στους πελάτες (εκροές). Τιμολ. = αγορές με τιμολόγιο. ΦΠΑ εισρ. = ο ΦΠΑ μέσα σε αυτά, ό,τι πλήρωσες σε αγορές με τιμολόγιο στο ΑΦΜ του γραφείου (εισροές), που συμψηφίζεται. Διαφορά ≈ ΦΠΑ προς απόδοση. Ενδεικτικά — τα τελικά τα βγάζει ο λογιστής.</div></div>`; })() : ''}
    ${(() => { const ys = [statY - 3, statY - 2, statY - 1, statY].filter((y) => O.incomes().some((r) => (r.md || r.d).startsWith(String(y))) || y === statY);
      const val = (x) => (cmpM === 'inc' ? x.inc : cmpM === 'exp' ? x.exp : x.inc - x.exp);
      const lastM = statY === Number(t.slice(0, 4)) ? t.slice(5, 7) : '12';
      const cell = (y, mm) => val(O.monthTotals(`${y}-${mm}`));
      const mms = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
      return `<h2>Σύγκριση με προηγούμενα χρόνια</h2><div class="chips" style="margin-bottom:6px">${[['inc', 'Έσοδα'], ['exp', 'Έξοδα'], ['res', 'Κέρδος']].map(([k, l]) => `<button class="chip ${cmpM === k ? 'on' : ''}" data-cmp="${k}">${l}</button>`).join('')}</div>
      <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Μήνας</th>${ys.map((y) => `<th class="r">${y}</th>`).join('')}</tr>
      ${mms.map((mm) => `<tr><td>${MSHORT[Number(mm) - 1]}</td>${ys.map((y) => `<td class="r ${y === statY ? '' : 'muted'}">${`${y}-${mm}` > t.slice(0, 7) ? '' : k0(cell(y, mm))}</td>`).join('')}</tr>`).join('')}
      <tr class="tot"><td>Ιαν–${MSHORT[Number(lastM) - 1]}</td>${ys.map((y) => `<td class="r">${k0(val(O.totals(`${y}-01-01`, `${y}-${lastM}-${statY === Number(t.slice(0, 4)) ? t.slice(8) : '31'}`)))}</td>`).join('')}</tr>
      <tr class="tot"><td>Όλη η χρονιά</td>${ys.map((y) => `<td class="r">${k0(val(O.totals(`${y}-01-01`, `${y}-12-31`)))}</td>`).join('')}</tr></table>
      <div class="small muted" style="margin-top:6px">«Ιαν–${MSHORT[Number(lastM) - 1]}» = το ίδιο διάστημα κάθε χρονιάς${statY === Number(t.slice(0, 4)) ? ' (ως σήμερα)' : ''}, για δίκαιη σύγκριση · Κέρδος = έσοδα − έξοδα (πριν τον μισθό)</div></div>`; })()}
    <h2>Ανά υπηρεσία</h2><div class="card">${bar(sv, Y.inc, 'svc') || '<span class="muted">—</span>'}</div>
    <h2>Έξοδα ανά κατηγορία</h2><div class="card">${bar(ct, Y.exp, 'cat') || '<span class="muted">—</span>'}</div>
    ${parts.length ? `<h2>Αμοιβές συνεργατών</h2><div class="card">${parts.map((x) => `<div class="row" style="margin:4px 0;cursor:pointer" data-go="${L(statY, 'part:' + x.p.id)}"><span class="grow">${esc(x.p.name)} <span class="small muted">${fmtPct(x.p.pct)}</span></span><b>${eur(x.v)}</b></div>`).join('')}</div>` : ''}
    <div class="row" style="margin:18px 2px 6px"><h2 class="grow" style="margin:0">Τρόπος πληρωμής</h2><button class="btn sm" data-pfee>💳 Προμήθειες ›</button></div><div class="card">${bar(pm, Y.inc, 'pay')}${Y.byCat.get(O.COMM_CAT) ? `<div class="small muted" style="margin-top:6px">Προμήθειες τραπεζών ${statY}: <b>${eur(Y.byCat.get(O.COMM_CAT))}</b> (${Object.entries(O.payFees()).map(([k, v]) => `${esc(k)} ${pctS(v.p) || 0}%${v.f ? ` + ${String(v.f).replace('.', ',')} €` : ''}`).join(' · ')})</div>` : ''}</div>
    ${(() => { const nw = O.clients().filter((c) => c.n && c.first && c.first.startsWith(String(statY))); const m = new Map(); let unk = 0;
      for (const c of nw) { const s = O.clientSource(c.name); if (!s) { unk++; continue; } const k = O.srcLabel(s); m.set(k, (m.get(k) || 0) + 1); }
      const l = [...m.entries()].sort((a, b) => b[1] - a[1]); if (!nw.length) return '';
      return `<h2>Πώς σε βρήκαν οι νέοι πελάτες ${statY}</h2><div class="card">${l.map(([k, v]) => `<div style="margin:6px 0"><div class="row"><span class="grow">${esc(k)}</span><b>${v}</b><span class="small muted" style="width:44px;text-align:right">${Math.round((v / nw.length) * 100)}%</span></div><div class="bar" style="margin-top:3px"><i style="width:${Math.round((v / l[0][1]) * 100)}%"></i></div></div>`).join('')}
        <div class="small muted" style="margin-top:6px">${nw.length} νέοι πελάτες${unk ? ` · ${unk} χωρίς «από πού σε έμαθε» (το βάζεις στα «Στοιχεία» του πελάτη)` : ''}</div></div>`; })()}
    <h2>Κορυφαίοι πελάτες ${statY}</h2><div class="list">${top.map((c) => `<div class="item" data-go="#/office/c/${encodeURIComponent(c.name)}"><div class="grow"><div class="t">${esc(c.name)}</div></div><div class="amt">${eur(c.y)}</div></div>`).join('')}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { statY += Number(b.dataset.y); ui.render(); }));
    root.querySelectorAll('[data-cmp]').forEach((b) => b.addEventListener('click', () => { cmpM = b.dataset.cmp; ui.render(); }));
  },
};

const fixedView = {
  html() {
    const fx = O.fixed(); const tot = fx.reduce((s, x) => s + (x.m || 0), 0); const t = today();
    let avg = 0; for (let i = 1; i <= 3; i++) { const m = addMonths(`${t.slice(0, 7)}-01`, -i).slice(0, 7); avg += O.monthTotals(m).inc; } avg /= 3;
    return `<div class="top">${back('#/office')}<h1>Πάγια γραφείου</h1><button class="btn sm primary" data-new>+ Πάγιο</button></div>
    <div class="grid2"><div class="card kpi"><div class="label">Χρειάζεσαι τον μήνα</div><div class="mid">${eur(tot)}</div><div class="small muted">${eur(tot * 12)} τον χρόνο</div></div>
      <div class="card kpi"><div class="label">Έσοδα (μ.ο. 3 μηνών)</div><div class="mid ${avg < tot ? 'neg' : 'pos'}">${eur(avg)}</div><div class="small muted">${avg >= tot ? `περισσεύουν ${eur(avg - tot)}` : `λείπουν ${eur(tot - avg)}`}</div></div></div>
    <div class="list">${fx.map((x) => `<div class="item" data-fx="${esc(x.id)}"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.note || '')}</div></div><div class="right"><div class="amt">${eur(x.m || 0)}</div><div class="small muted">${eur((x.m || 0) * 12)}/έτος</div></div></div>`).join('') || '<div class="item muted">Κανένα</div>'}</div>
    <div class="note small" style="margin-top:12px">Ο προϋπολογισμός σου: τι πρέπει να βγάζει το γραφείο κάθε μήνα για να καλύπτει τα σταθερά του. Τα πραγματικά έξοδα τα γράφεις στο «− Έξοδο γραφείου» (ή ως επαναλαμβανόμενα).</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    const ed = (x) => sheet(`<div class="mid">${x ? 'Πάγιο' : 'Νέο πάγιο'}</div>
      <label class="f" style="margin-top:10px"><span>Τι</span><input name="name" value="${esc(x?.name || '')}" placeholder="π.χ. Ενοίκιο"></label>
      <div class="grid2"><label class="f"><span>Ποσό τον μήνα (€)</span><input name="m" inputmode="decimal" value="${esc(x?.m != null ? String(Math.round(x.m * 100) / 100).replace('.', ',') : '')}" placeholder="π.χ. 500 ή 185,88/12"></label>
      <label class="f"><span>Σημείωση</span><input name="note" value="${esc(x?.note || '')}"></label></div>
      <button class="btn primary" data-ok>Αποθήκευση</button>${x ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
      el.querySelector('[data-no]').onclick = close;
      el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del(x._sp, x.id); close(); });
      el.querySelector('[data-ok]').onclick = async () => { const name = el.querySelector('[name=name]').value.trim(); if (!name) return; await store.put(x?._sp || O.OSP, x?.id || null, { type: 'ofix', name, m: parseAmount(el.querySelector('[name=m]').value) || 0, note: el.querySelector('[name=note]').value.trim() || null }); close(); };
    });
    root.querySelector('[data-new]').addEventListener('click', () => ed(null));
    root.querySelectorAll('[data-fx]').forEach((b) => b.addEventListener('click', () => ed(O.fixed().find((x) => x.id === b.dataset.fx))));
  },
};
const recView = {
  html() {
    const t = today();
    const defs = store.records('rec', [O.OSP]).filter((r) => r.biz || r.salary).sort((a, b) => (a.end && a.end < t ? 1 : 0) - (b.end && b.end < t ? 1 : 0) || (a.name || '').localeCompare(b.name || '', 'el'));
    return `<div class="top">${back('#/office')}<h1>Επαναλαμβανόμενα γραφείου</h1></div>
    <div class="list">${defs.map((r) => `<div class="item" data-go="#/rec/${esc(r._sp)}/${esc(r.id)}" style="${r.end && r.end < t ? 'opacity:.55' : ''}"><div class="dot">${r.salary ? '👩‍⚕️' : '↻'}</div>
      <div class="grow"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.cat || '')} · από ${dFull(r.start)}${r.end ? ' έως ' + dFull(r.end) : ''}</div></div><div class="amt">${eur(r.a)}</div></div>`).join('') || '<div class="item muted">Κανένα — φτιάχνονται από «− Έξοδο γραφείου» με ↻ Επαναλαμβάνεται</div>'}</div>`;
  },
  mount(root, p, ui) { bindCommon(root, ui); },
};

const cashView = {
  html() {
    const bal = O.balance(); const pr = O.pref(); const sal = O.salaryDef(); const t = today();
    const odebts = O.officeDebts().filter((x) => x.owed > 0.004);
    const owed = O.partners().map((p) => ({ p, ...O.partnerStatus(p.id) })).filter((x) => Math.abs(x.owed) > 0.004);
    return `<div class="top">${back('#/office')}<h1>Ταμείο & μισθός</h1></div>
    <div class="card" data-goal style="cursor:pointer"><div class="row"><b class="grow">🏦 Ταμείο γραφείου</b><b class="${bal < 0 ? 'neg' : 'pos'}" style="font-size:20px">${eur(bal)}</b></div>
      <div class="small muted" style="margin-top:4px">Πόσα χρήματα έχει η επιχείρηση${pr.asOf ? ` σήμερα: όσα είχε ο λογαριασμός στις ${dFull(pr.asOf)} + έσοδα − έξοδα − μισθοί από τότε` : ': όλα τα έσοδα − όλα τα έξοδα − οι μισθοί σου από την αρχή'}. Τα έξοδα που πλήρωσε άλλος για το γραφείο αφαιρούνται όταν του τα επιστρέψεις.</div>
      ${pr.asOf ? '' : '<div class="small neg" style="margin-top:4px">⚠ Πάτα εδώ και γράψε πόσα έχει πραγματικά ο λογαριασμός του γραφείου σήμερα, για να είναι σωστό.</div>'}
      ${pr.goal ? `<div class="bar" style="margin-top:8px"><i style="width:${Math.max(0, Math.min(100, Math.round((bal / pr.goal) * 100)))}%"></i></div><div class="small muted" style="margin-top:4px">Μαξιλάρι γραφείου: στόχος ${eur(pr.goal)} · ${bal >= pr.goal ? '✓ πέτυχε' : `λείπουν ${eur(pr.goal - bal)}`}</div>` : '<div class="small muted" style="margin-top:4px">Πάτα για στόχο «μαξιλάρι γραφείου»</div>'}</div>
    ${odebts.length || owed.length ? `<div class="card"><b>Τι χρωστάει το γραφείο</b>
      ${odebts.map((x) => `<div class="row small" style="margin-top:6px"><a class="grow" href="#/odebt/${encodeURIComponent(x.who)}" style="color:inherit">${x.who === 'Άλκης' ? 'Στον Άλκη' : 'Σε ' + esc(x.who)} <b class="neg">${eur(x.owed)}</b> (πλήρωσε έξοδα για το γραφείο) ›</a><button class="btn sm" data-orep="${esc(x.who)}">Τον πλήρωσα</button></div>`).join('')}
      ${owed.map((x) => `<div class="small" style="margin-top:6px"><a href="#/office/partners">Σε ${esc(x.p.name)} <b class="neg">${eur(x.owed)}</b> (αμοιβές συνεργασίας) ›</a></div>`).join('')}</div>` : ''}
    <div class="card" data-sal style="cursor:pointer"><div class="row"><span class="dot">👩‍⚕️</span><div class="grow"><div class="small muted">Μισθός σου (έξοδο του γραφείου → έσοδο στα προσωπικά σου)</div>
      <div class="mid">${sal ? `${eur(sal.a)} τον μήνα · από ${dFull(sal.start)}` : 'Όρισε μισθό'}</div></div><span class="muted">›</span></div></div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelector('[data-sal]').addEventListener('click', () => salarySheet(ui));
    root.querySelector('[data-goal]').addEventListener('click', () => goalSheet(ui));
    root.querySelectorAll('[data-orep]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); repaySheet(b.dataset.orep); }));
  },
};
const PAGES = { cash: cashView, list, clients: clientsView, c: clientView, partners: partnersView, stats: statsView, fixed: fixedView, rec: recView, in: entryView('in'), ex: entryView('ex') };
const denied = { html: () => '<div class="card">Το γραφείο φαίνεται μόνο στη Χαρά.</div>' };
const pick = (p) => (!O.hasOffice() ? denied : PAGES[p[0]] || home);
export default {
  get live() { return !/^#\/office\/(in|ex)\//.test(location.hash); },     // do not redraw a half-filled form
  html(p, ui) { return pick(p).html(p.slice(1), ui); },
  mount(root, p, ui) { pick(p).mount?.(root, p.slice(1), ui); },
};
