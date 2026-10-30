// #/office… — Γραφείο της Χαράς: home, client payments, office expenses, clients, partners, statistics, fixed costs
import { esc, eur, today, dShort, dFull, MONTHS, MSHORT, parseAmount, norm, addMonths } from '../../util.js';
import * as store from '../../store.js';
import * as O from '../../office.js';
import { syncBadge } from '../../main.js';
import { sheet } from '../lessons/ui.js';
import { entryView } from './entry.js';

const k0 = (x) => eur(x).replace(' €', '');
const back = (h) => `<button class="btn sm ghost" data-back="${h || ''}">‹</button>`;
const bindCommon = (root, ui) => {
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => (b.dataset.back ? ui.go(b.dataset.back) : ui.back())));
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
};
const payRow = (r) => `<div class="item" data-go="#/office/in/${esc(r.id)}"><div class="dot">💶</div>
  <div class="grow"><div class="t">${esc(r.cl || '—')}</div><div class="s">${dShort(r.d)} · ${esc(r.svc || '')}${r.pay ? ' · ' + esc(r.pay) : ''}${r.part ? ' · 🤝 ' + esc(O.partner(r.part)?.name || '') : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
  <div class="right"><div class="amt pos">+${eur(r.a)}</div>${r.rcpt ? '<div class="small muted">🧾 απόδειξη</div>' : ''}</div></div>`;
const expRow = (r) => `<div class="item" data-go="${r.sal ? `#/rec/${esc(r._sp)}/${esc(r.rec)}` : r.rec ? `#/edit/${esc(r._sp)}/${encodeURIComponent(r.id)}` : `#/office/ex/${esc(r.id)}`}"><div class="dot">${r.sal ? '👩‍⚕️' : r.rec ? '↻' : '🧾'}</div>
  <div class="grow"><div class="t">${esc(r.desc || r.cat || '')}</div><div class="s">${dShort(r.d)} · ${esc(r.cat || '')}${r.part ? ' · 🤝 ' + esc(O.partner(r.part)?.name || '') : ''}${r.pay ? ' · ' + esc(r.pay) : ''}</div></div>
  <div class="amt">−${eur(r.a)}</div></div>`;

let monthOff = 0;
const home = {
  html() {
    const t = today(); const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + monthOff);
    const m = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
    const z = O.monthTotals(m); const ly = O.totals(`${Number(m.slice(0, 4)) - 1}${m.slice(4)}-01`, `${Number(m.slice(0, 4)) - 1}${m.slice(4)}-${monthOff === 0 ? t.slice(8) : '31'}`);
    const bal = O.balance(); const pr = O.pref(); const sal = O.salaryDef();
    const owed = O.partners().map((p) => ({ p, ...O.partnerStatus(p.id) })).filter((x) => Math.abs(x.owed) > 0.004);
    const recent = O.incomes().slice(0, 8);
    const upcoming = O.expenses(true).filter((r) => r.d > t && r.d <= addMonths(t, 1).slice(0, 10)).reverse().slice(0, 6);
    return `<div class="top"><h1>Γραφείο</h1>${syncBadge()}</div>
    <div class="grid2 quick" style="margin-bottom:12px"><a class="btn green" href="#/office/in/new">+ Πληρωμή πελάτη</a><a class="btn red" href="#/office/ex/new">− Έξοδο γραφείου</a></div>
    <div class="card">
      <div class="row"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}${monthOff === 0 ? ' <span class="small muted">ως σήμερα</span>' : ''}</div>
        <button class="btn sm ghost" data-m="1" ${monthOff >= 0 ? 'disabled' : ''}>▶</button></div>
      <div class="grid3 center" style="margin-top:10px">
        <div><div class="small muted">Έσοδα</div><div class="mid pos">${eur(z.inc)}</div></div>
        <div><div class="small muted">Έξοδα</div><div class="mid neg">${eur(z.exp)}</div></div>
        <div><div class="small muted">Μισθός</div><div class="mid">${eur(z.sal)}</div></div></div>
      <div class="center" style="margin-top:8px">Αποτέλεσμα <b class="${z.res < 0 ? 'neg' : 'pos'}">${eur(z.res)}</b></div>
      <div class="small muted center" style="margin-top:4px">${z.n} πληρωμές · 🧾 με απόδειξη ${eur(z.rcpt)}${z.fee ? ` · αμοιβές συνεργατών ${eur(z.fee)}` : ''}<br>Ίδια περίοδος πέρσι: έσοδα ${eur(ly.inc)} · έξοδα ${eur(ly.exp)}</div>
      <div class="center" style="margin-top:8px"><button class="btn sm" data-go="#/office/list/${m}">Κινήσεις μήνα ›</button></div></div>
    <div class="card" data-goal style="cursor:pointer"><div class="row"><b class="grow">🏢 Υπόλοιπο γραφείου</b><b class="${bal < 0 ? 'neg' : 'pos'}" style="font-size:20px">${eur(bal)}</b></div>
      ${pr.asOf ? '' : '<div class="small neg" style="margin-top:4px">⚠ Δεν έχεις ορίσει πόσα έχει πραγματικά ο λογαριασμός — εδώ μετράνε όλα τα έσοδα − έξοδα από την αρχή, χωρίς τα λεφτά που πήρες για σένα. Πάτα εδώ.</div>'}
      ${pr.goal ? `<div class="bar" style="margin-top:8px"><i style="width:${Math.max(0, Math.min(100, Math.round((bal / pr.goal) * 100)))}%"></i></div><div class="small muted" style="margin-top:4px">Μαξιλάρι γραφείου: στόχος ${eur(pr.goal)} · ${bal >= pr.goal ? '✓ πέτυχε' : `λείπουν ${eur(pr.goal - bal)}`}</div>` : '<div class="small muted" style="margin-top:4px">Πάτα για στόχο «μαξιλάρι γραφείου» ή αρχικό ποσό</div>'}
      ${owed.length ? `<div class="small" style="margin-top:6px">Χρωστάς σε συνεργάτες: ${owed.map((x) => `${esc(x.p.name)} <b class="neg">${eur(x.owed)}</b>`).join(' · ')}</div>` : ''}</div>
    <div class="card" data-sal style="cursor:pointer"><div class="row"><span class="dot">👩‍⚕️</span><div class="grow"><div class="small muted">Μισθός Χαράς (έξοδο γραφείου → έσοδο στα προσωπικά)</div>
      <div class="mid">${sal ? `${eur(sal.a)} τον μήνα · από ${dFull(sal.start)}` : 'Όρισε μισθό'}</div></div><span class="muted">›</span></div></div>
    <h2>Τελευταίες πληρωμές</h2>
    <div class="list">${recent.map(payRow).join('') || '<div class="item muted">Καμία ακόμα</div>'}</div>
    ${upcoming.length ? `<h2>Έρχονται (30 μέρες)</h2><div class="list">${upcoming.map(expRow).join('')}</div>` : ''}
    <div class="grid3" style="margin-top:12px">
      <a class="btn sm" href="#/office/clients">👥 Πελάτες</a><a class="btn sm" href="#/office/partners">🤝 Συνεργάτες</a><a class="btn sm" href="#/office/stats">📊 Στατιστικά</a>
      <a class="btn sm" href="#/office/fixed">📋 Πάγια</a><a class="btn sm" href="#/office/rec">↻ Επαναλ.</a><a class="btn sm" href="#/office/list/${t.slice(0, 7)}">📄 Κινήσεις</a>
    </div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { monthOff = Math.min(0, monthOff + Number(b.dataset.m)); ui.render(); }));
    root.querySelector('[data-sal]').addEventListener('click', () => salarySheet(ui));
    root.querySelector('[data-goal]').addEventListener('click', () => goalSheet(ui));
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
  html([m]) {
    m = m || today().slice(0, 7);
    const n = norm(listQ).trim();
    const inc = O.incomes(true).filter((r) => (n ? norm(`${r.cl} ${r.svc} ${r.note || ''} ${r.pay || ''}`).includes(n) : (r.md || r.d).startsWith(m)));
    const exp = O.expenses(true).filter((r) => (n ? norm(`${r.desc} ${r.cat} ${r.note || ''}`).includes(n) : r.d.startsWith(m)));
    const all = [...inc.map((r) => ({ r, k: 'in' })), ...exp.map((r) => ({ r, k: 'ex' }))].sort((a, b) => (a.r.d < b.r.d ? 1 : -1));
    const si = inc.reduce((s, r) => s + (r.a || 0), 0), se = exp.reduce((s, r) => s + (r.a || 0), 0);
    let html = '', last = '';
    for (const { r, k } of all.slice(0, 400)) { if (r.d !== last) { html += `<div class="day">${dShort(r.d)}${n ? ' ' + r.d.slice(0, 4) : ''}</div>`; last = r.d; } html += k === 'in' ? payRow(r) : expRow(r); }
    const [y, mo] = m.split('-').map(Number);
    return `<div class="top">${back('#/office')}<h1>Κινήσεις γραφείου</h1></div>
    <input type="search" name="q" placeholder="🔍 Πελάτης, υπηρεσία, έξοδο…" value="${esc(listQ)}" style="margin-bottom:10px">
    ${n ? '' : `<div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-mm="${addMonths(`${m}-01`, -1).slice(0, 7)}">◀</button><div class="grow center mid">${MONTHS[mo - 1]} ${y}</div><button class="btn sm ghost" data-mm="${addMonths(`${m}-01`, 1).slice(0, 7)}">▶</button></div>`}
    <div class="card grid3 center" style="padding:10px 6px;margin-bottom:8px"><div><div class="small muted">Έσοδα</div><b class="pos">${eur(si)}</b></div><div><div class="small muted">Έξοδα</div><b class="neg">${eur(se)}</b></div><div><div class="small muted">Διαφορά</div><b class="${si - se < 0 ? 'neg' : 'pos'}">${eur(si - se)}</b></div></div>
    <div class="list">${html || '<div class="item muted">Καμία κίνηση</div>'}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => ui.go(`#/office/list/${b.dataset.mm}`)));
    const qi = root.querySelector('[name=q]');
    qi.addEventListener('input', () => { listQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const x = document.querySelector('[name=q]'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); });
  },
};

let clQ = '';
const clientsView = {
  html() {
    const n = norm(clQ).trim(); const t = today();
    const cs = O.clients().filter((c) => !n || norm(c.name).includes(n)).sort((a, b) => (a.last < b.last ? 1 : -1));
    const act = cs.filter((c) => c.last >= addMonths(t, -2));
    return `<div class="top">${back('#/office')}<h1>Πελάτες</h1></div>
    <input type="search" name="q" placeholder="🔍 Όνομα" value="${esc(clQ)}" style="margin-bottom:8px">
    <div class="small muted" style="margin:0 4px 8px">${cs.length} πελάτες · ${act.length} με επίσκεψη τους τελευταίους 2 μήνες</div>
    <div class="list">${cs.slice(0, 300).map((c) => `<div class="item" data-go="#/office/c/${encodeURIComponent(c.name)}"><div class="dot">${esc(c.name.slice(0, 1))}</div>
      <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${c.n} ${c.n === 1 ? 'πληρωμή' : 'πληρωμές'} · τελευταία ${dFull(c.last)}${c.lastSvc ? ' · ' + esc(c.lastSvc) : ''}</div></div>
      <div class="amt">${eur(c.sum)}</div></div>`).join('') || '<div class="item muted">Κανένας</div>'}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    const qi = root.querySelector('[name=q]');
    qi.addEventListener('input', () => { clQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { ui.render(); const x = document.querySelector('[name=q]'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); });
  },
};
const clientView = {
  html([name]) {
    const ps = O.clientPays(name); const sum = ps.reduce((s, r) => s + (r.a || 0), 0);
    return `<div class="top">${back()}<h1>${esc(name)}</h1></div>
    <div class="grid3"><div class="card kpi"><div class="label">Σύνολο</div><div class="mid">${eur(sum)}</div></div>
      <div class="card kpi"><div class="label">Πληρωμές</div><div class="mid">${ps.length}</div></div>
      <div class="card kpi"><div class="label">Από</div><div class="mid">${ps.length ? dFull(ps[ps.length - 1].d) : '—'}</div></div></div>
    <a class="btn green" style="width:100%;margin-bottom:12px" href="#/office/in/new?cl=${encodeURIComponent(name)}">+ Πληρωμή από ${esc(name.split(' ')[0])}</a>
    <div class="list">${ps.map(payRow).join('')}</div>`;
  },
  mount(root, p, ui) { bindCommon(root, ui); },
};

const partnersView = {
  html() {
    const ps = O.partners();
    return `<div class="top">${back('#/office')}<h1>Συνεργάτες</h1><button class="btn sm primary" data-new>+ Συνεργάτης</button></div>
    <div class="small muted" style="margin:-4px 4px 10px">Χώροι που σου στέλνουν πελάτες (π.χ. Nadi). Το ποσοστό είναι η αμοιβή τους για κάθε πελάτη/ραντεβού που προωθούν.</div>
    <div class="list">${ps.map((p) => { const s = O.partnerStatus(p.id); return `<div class="item" style="display:block;${p.active === false ? 'opacity:.6' : ''}">
      <div class="row" data-edit="${esc(p.id)}" style="cursor:pointer"><div class="grow"><div class="t">${esc(p.name)} <span class="small muted">· ${fmtPct(p.pct)}${p.active === false ? ' · ανενεργός' : ''}</span></div>
        <div class="s">${s.n} πελάτες · αμοιβές ${eur(s.fees)} · πληρώθηκαν ${eur(s.paid)}</div></div>
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
    <label class="f"><span>Αμοιβή συνεργασίας (ποσοστό)</span><input name="pct" value="${p ? (Math.abs((p.pct || 0) - 1 / 3) < 1e-6 ? '1/3' : String(Math.round((p.pct || 0) * 1000) / 10).replace('.', ',') + '%') : ''}" placeholder="π.χ. 20% ή 1/3"></label>
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
      await store.put(p?._sp || O.OSP, p?.id || null, { type: 'opart', name, pct, active: el.querySelector('[name=active]').checked });
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
    const bar = (l, tot) => l.map(([k, v]) => `<div style="margin:6px 0"><div class="row"><span class="grow">${esc(k)}</span><b>${eur(v)}</b><span class="small muted" style="width:44px;text-align:right">${tot ? Math.round((v / tot) * 100) : 0}%</span></div><div class="bar" style="margin-top:3px"><i style="width:${tot ? Math.round((v / l[0][1]) * 100) : 0}%"></i></div></div>`).join('');
    return `<div class="top">${back('#/office')}<h1>Στατιστικά γραφείου</h1></div>
    <div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-y="-1">◀</button><div class="grow center mid">${statY}</div><button class="btn sm ghost" data-y="1" ${statY >= Number(t.slice(0, 4)) ? 'disabled' : ''}>▶</button></div>
    <div class="card" style="overflow-x:auto"><table class="t st"><tr><th>Μήνας</th><th class="r">Έσοδα</th><th class="r">🧾</th><th class="r">Έξοδα</th>${hasSal ? '<th class="r">Μισθός</th>' : ''}<th class="r">Αποτέλ.</th></tr>
      ${rows.slice().reverse().map((r) => `<tr class="click" data-go="#/office/list/${r.m}"><td>${MSHORT[Number(r.m.slice(5)) - 1]}</td><td class="r pos">${k0(r.inc)}</td><td class="r muted">${k0(r.rcpt)}</td><td class="r">${k0(r.exp)}</td>${hasSal ? `<td class="r">${k0(r.sal)}</td>` : ''}<td class="r ${r.res < 0 ? 'neg' : 'pos'}">${k0(r.res)}</td></tr>`).join('')}
      <tr class="tot"><td>Σύνολο</td><td class="r">${k0(Y.inc)}</td><td class="r">${k0(Y.rcpt)}</td><td class="r">${k0(Y.exp)}</td>${hasSal ? `<td class="r">${k0(Y.sal)}</td>` : ''}<td class="r">${k0(Y.res)}</td></tr>
      <tr><td>Μ.Ο.</td><td class="r">${k0(Y.inc / n)}</td><td class="r">${k0(Y.rcpt / n)}</td><td class="r">${k0(Y.exp / n)}</td>${hasSal ? `<td class="r">${k0(Y.sal / n)}</td>` : ''}<td class="r">${k0(Y.res / n)}</td></tr></table>
      <div class="small muted" style="margin-top:6px">σε € · 🧾 = με απόδειξη · πάτα μήνα για τις κινήσεις</div></div>
    <h2>Ανά υπηρεσία</h2><div class="card">${bar(sv, Y.inc) || '<span class="muted">—</span>'}</div>
    <h2>Έξοδα ανά κατηγορία</h2><div class="card">${bar(ct, Y.exp) || '<span class="muted">—</span>'}</div>
    ${parts.length ? `<h2>Αμοιβές συνεργατών</h2><div class="card">${parts.map((x) => `<div class="row" style="margin:4px 0"><span class="grow">${esc(x.p.name)} <span class="small muted">${fmtPct(x.p.pct)}</span></span><b>${eur(x.v)}</b></div>`).join('')}</div>` : ''}
    <h2>Τρόπος πληρωμής</h2><div class="card">${bar(pm, Y.inc)}</div>
    <h2>Κορυφαίοι πελάτες ${statY}</h2><div class="list">${top.map((c) => `<div class="item" data-go="#/office/c/${encodeURIComponent(c.name)}"><div class="grow"><div class="t">${esc(c.name)}</div></div><div class="amt">${eur(c.y)}</div></div>`).join('')}</div>`;
  },
  mount(root, p, ui) {
    bindCommon(root, ui);
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { statY += Number(b.dataset.y); ui.render(); }));
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

const PAGES = { list, clients: clientsView, c: clientView, partners: partnersView, stats: statsView, fixed: fixedView, rec: recView, in: entryView('in'), ex: entryView('ex') };
const denied = { html: () => '<div class="card">Το γραφείο φαίνεται μόνο στη Χαρά.</div>' };
const pick = (p) => (!O.hasOffice() ? denied : PAGES[p[0]] || home);
export default {
  get live() { return !/^#\/office\/(in|ex)\//.test(location.hash); },     // do not redraw a half-filled form
  html(p, ui) { return pick(p).html(p.slice(1), ui); },
  mount(root, p, ui) { pick(p).mount?.(root, p.slice(1), ui); },
};
