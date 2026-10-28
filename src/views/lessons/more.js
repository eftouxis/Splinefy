// Lessons: student form, weekly schedule, salaries, statistics, holidays, all students
import { esc, eur, eur0, today, addDays, dShort, dFull, MONTHS, MSHORT, MONTHS_GEN, parseAmount, pad } from '../../util.js';
import * as store from '../../store.js';
import * as L from '../../lessons.js';
import { sheet, slotSheet, lessonSheet, fmtH, hoursTxt, DSHORT } from './ui.js';

const back = (h = '#/lessons') => `<button class="btn sm ghost" data-back="${h}">‹</button>`;
const bindBack = (root, ui) => root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.back)));
const hrs = (v) => parseAmount(String(v || '').replace(/(\d+):(\d+)/, '$1+$2/60'));

// ---------------- student form ----------------
export const editView = {
  html([id]) {
    const st = id === 'new' ? null : L.student(id);
    const t = today(); const pr = st ? L.priceAt(st) : {};
    return `<div class="top">${back(st ? `#/lessons/s/${st.id}` : '#/lessons')}<h1>${st ? 'Επεξεργασία μαθητή' : 'Νέος μαθητής'}</h1></div>
    <div class="card">
      <div class="grid2"><label class="f"><span>Όνομα (όπως θες να φαίνεται)</span><input name="name" value="${esc(st?.name || '')}" placeholder="π.χ. Πάνος"></label>
      <label class="f"><span>Ονοματεπώνυμο</span><input name="full" value="${esc(st?.full || '')}" placeholder="π.χ. Πάνος Κανούρης"></label></div>
      <div class="grid2"><label class="f"><span>Τιμή μαθήματος (€)</span><input name="price" inputmode="decimal" value="${esc(pr.price ?? '')}"></label>
      <label class="f"><span>Διάρκεια (ώρες, π.χ. 1,5 ή 1:20)</span><input name="dur" inputmode="decimal" value="${pr.dur ? fmtH(pr.dur) : '1'}"></label></div>
      <div class="small muted" data-rate style="margin:-4px 2px 10px"></div>
      <div class="grid2"><label class="f"><span>Ξεκίνησε</span><input type="date" name="start" value="${esc(st?.start || t)}"></label>
      <label class="f"><span>Σταμάτησε (κενό = συνεχίζει)</span><input type="date" name="end" value="${esc(st?.end || '')}"></label></div>
      <label class="f"><span>Σημειώσεις</span><input name="note" value="${esc(st?.note || '')}" placeholder="π.χ. Γ΄ Λυκείου · γονιός: …"></label>
      <details class="more" ${st?.open ? 'open' : ''}><summary>Περισσότερα ▾</summary>
        <label class="f"><span>Χρωστούμενα από πριν (€, − αν έχει προπληρώσει)</span><input name="open" inputmode="decimal" value="${esc(st?.open ?? '')}"></label>
        ${(st?.rates || []).length ? `<div class="small muted">Αλλαγές τιμής: ${st.rates.map((r) => `${dFull(r.from)}: ${eur(r.price)} / ${hoursTxt(r.dur)}`).join(' · ')}</div>` : ''}
      </details>
    </div>
    <button class="btn primary" style="width:100%" data-save>${st ? 'Αποθήκευση' : 'Προσθήκη μαθητή'}</button>
    ${st ? `<button class="btn" style="width:100%;margin-top:8px;color:var(--red)" data-del>Διαγραφή μαθητή</button>` : ''}`;
  },
  mount(root, [id], ui) {
    bindBack(root, ui);
    const st = id === 'new' ? null : L.student(id);
    const g = (n) => root.querySelector(`[name=${n}]`).value.trim();
    const rate = () => { const p = parseAmount(g('price')), d = hrs(g('dur')); root.querySelector('[data-rate]').textContent = p && d ? `= ${eur(p / d)} την ώρα` : ''; };
    rate(); root.querySelector('[name=price]').addEventListener('input', rate); root.querySelector('[name=dur]').addEventListener('input', rate);
    if (!st) setTimeout(() => root.querySelector('[name=name]').focus(), 50);
    root.querySelector('[data-del]')?.addEventListener('click', async () => {
      const n = L.lessons({ stu: id, to: today() }).length + L.payments(id).length;
      if (!(await ui.confirm(n ? `Ο μαθητής έχει ${n} μαθήματα/πληρωμές. Καλύτερα βάλε ημερομηνία «Σταμάτησε». Να διαγραφεί οριστικά;` : 'Διαγραφή μαθητή;', 'Διαγραφή'))) return;
      await store.putMany(L.LSP, [{ id, del: true }, ...L.slots(id).map((s) => ({ id: s.id, del: true }))]);
      ui.toast('Διαγράφηκε'); ui.go('#/lessons');
    });
    root.querySelector('[data-save]').addEventListener('click', async () => {
      const name = g('name'); const price = parseAmount(g('price')); const dur = hrs(g('dur'));
      if (!name || !price || !dur) { ui.toast('Όνομα, τιμή και διάρκεια'); return; }
      const rec = { type: 'student', name, full: g('full') || null, start: g('start') || today(), end: g('end') || null, note: g('note') || null, open: parseAmount(g('open')) };
      if (!st) {
        const nid = await store.put(L.LSP, null, { ...rec, price, dur });
        ui.toast('Προστέθηκε ✓ — βάλε τώρα το πρόγραμμά του'); ui.go(`#/lessons/s/${nid}`); setTimeout(() => slotSheet(ui, nid), 300); return;
      }
      const pr = L.priceAt(st);
      if (Math.abs(price - pr.price) > 1e-9 || Math.abs(dur - pr.dur) > 1e-9) {
        const hasPast = L.lessons({ stu: id, to: today() }).length > 0;
        let from = null;
        if (hasPast) {
          from = await new Promise((res) => sheet(`<div class="mid">Από πότε ισχύει η νέα τιμή;</div>
            <label class="f" style="margin-top:10px"><span>Από</span><input type="date" name="from" value="${today()}"></label>
            <button class="btn primary" data-a>Από αυτή την ημερομηνία</button><button class="btn" data-b>Για όλα τα μαθήματα (διόρθωση)</button>
            <button class="btn ghost" data-c>Άκυρο</button>`, (el, close) => {
            el.querySelector('[data-a]').onclick = () => { const v = el.querySelector('[name=from]').value; close(); res(v || today()); };
            el.querySelector('[data-b]').onclick = () => { close(); res(''); };
            el.querySelector('[data-c]').onclick = () => { close(); res(null); };
          }));
          if (from === null) return;
        }
        if (from) rec.rates = [...(st.rates || []).filter((r) => r.from < from), { from, price, dur }];
        else { rec.price = price; rec.dur = dur; rec.rates = null; }
      }
      await store.put(L.LSP, id, rec);
      ui.toast('Αποθηκεύτηκε ✓'); ui.go(`#/lessons/s/${id}`);
    });
  },
};

// ---------------- weekly schedule (all students) ----------------
export const schedView = {
  html() {
    const t = today();
    const sl = L.slots().filter((s) => !s.to || s.to >= t);
    const byDay = [1, 2, 3, 4, 5, 6, 7].map((wd) => sl.filter((s) => s.wd === wd).sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1)));
    const tot = sl.reduce((a, s) => a + s.h * L.rateAt(L.student(s.stu), t), 0), th = sl.reduce((a, s) => a + s.h, 0);
    const act = L.students().filter((s) => L.isActive(s));
    return `<div class="top">${back()}<h1>Πρόγραμμα εβδομάδας</h1></div>
    <div class="card row"><div class="grow"><div class="small muted">Κάθε εβδομάδα</div><div class="mid">${hoursTxt(th)} · ${eur(tot)}</div></div></div>
    ${byDay.map((list, i) => list.length ? `<h2>${L.DAYNAMES[i]}</h2><div class="list">${list.map((s) => {
      const st = L.student(s.stu);
      return `<div class="item" data-slot="${esc(s.id)}"><div class="dot" style="font-size:12px;font-weight:700">${esc((s.time || '').split(/[–-]/)[0] || '•')}</div>
      <div class="grow"><div class="t">${esc(st.name)}</div><div class="s">${hoursTxt(s.h)}${s.time ? ' · ' + esc(s.time) : ''} · ${s.from > t ? 'από ' + dFull(s.from) : 'έως ' + (s.to ? dFull(s.to) : '—')}</div></div>
      <div class="amt">${eur(s.h * L.rateAt(st, t))}</div></div>`;
    }).join('')}</div>` : '').join('')}
    <h2>Προσθήκη ημέρας σε μαθητή</h2>
    <div class="chips">${act.map((s) => `<button class="chip" data-newslot="${esc(s.id)}">+ ${esc(s.name)}</button>`).join('')}</div>
    <div class="note small" style="margin-top:12px">Τα μαθήματα του προγράμματος μπαίνουν μόνα τους στις καρτέλες, εκτός από τις αργίες. Αλλαγή από μια μέρα και μετά: πάτα τη γραμμή → «Η αλλαγή ισχύει από».</div>`;
  },
  mount(root, p, ui) {
    bindBack(root, ui);
    root.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => { const s = L.slots().find((x) => x.id === b.dataset.slot); slotSheet(ui, s.stu, s); }));
    root.querySelectorAll('[data-newslot]').forEach((b) => b.addEventListener('click', () => slotSheet(ui, b.dataset.newslot)));
  },
};

// ---------------- salaries (amount per month it concerns + the day it was paid) ----------------
let salY = null;
const eom = (m) => { const [y, mo] = m.split('-').map(Number); return `${m}-${pad(new Date(y, mo, 0).getDate())}`; };
export const salView = {
  html() {
    const t = today(); salY = salY ?? L.yearOf(t);
    const months = L.yMonths(salY).slice(1);            // July … June
    const sal = store.records('sal', [L.LSP]).filter((s) => months.includes(s.m));
    const srcs = [...new Set(store.records('sal', [L.LSP]).map((s) => s.src))];
    const tot = sal.reduce((a, s) => a + (s.a || 0), 0), paid = sal.filter((s) => s.paid).reduce((a, s) => a + (s.a || 0), 0);
    const rows = months.map((m) => {
      const list = sal.filter((s) => s.m === m); if (!list.length) return '';
      return `<div class="day">${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div>` + list.map((s) => {
        const late = !s.paid && eom(m) < t;
        return `<div class="item" data-sal="${esc(s.id)}"><div class="dot">💼</div><div class="grow"><div class="t">${esc(s.src)}</div>
          <div class="s ${late ? 'neg' : ''}">${s.paid ? '✓ πληρώθηκε ' + dFull(s.paid) : late ? '⚠ ο μήνας τελείωσε — δεν έχει πληρωθεί' : 'αναμένεται'}</div></div>
          <div class="amt ${s.paid ? 'pos' : 'muted'}">${eur(s.a)}</div></div>`;
      }).join('');
    }).join('');
    return `<div class="top">${back()}<h1>Μισθοί</h1></div>
    <div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-y="-1">◀</button><div class="grow center mid">Χρονιά ${L.yLabel(salY)}</div><button class="btn sm ghost" data-y="1">▶</button></div>
    <div class="grid2"><div class="card kpi"><div class="label">Σύνολο χρονιάς</div><div class="mid">${eur(tot)}</div></div>
      <div class="card kpi"><div class="label">Έχουν πληρωθεί</div><div class="mid pos">${eur(paid)}</div></div></div>
    <div class="list">${rows || '<div class="item muted">Κανένας μισθός σε αυτή τη χρονιά</div>'}</div>
    <button class="btn primary" style="width:100%;margin-top:12px" data-add>+ Μισθός (ένας ή πολλοί μήνες)</button>
    <div class="note small" style="margin-top:12px">Ο μισθός γράφεται στον μήνα που αφορά (π.χ. ο Οκτωβρίου στον Οκτώβριο). Μόλις πατήσεις «Πληρώθηκε» με την ημερομηνία που μπήκαν τα χρήματα, μπαίνει μόνος του στα έσοδα (Μισθός) και μετράει στον μήνα που αφορά.${srcs.length ? '' : ''}</div>`;
  },
  mount(root, p, ui) {
    bindBack(root, ui);
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { salY += Number(b.dataset.y); ui.render(); }));
    root.querySelectorAll('[data-sal]').forEach((b) => b.addEventListener('click', () => salSheet(ui, store.records('sal', [L.LSP]).find((s) => s.id === b.dataset.sal))));
    root.querySelector('[data-add]').addEventListener('click', () => salAddSheet(ui, salY));
  },
};
function salSheet(ui, s) {
  const t = today();
  sheet(`<div class="mid">${esc(s.src)} · ${MONTHS[Number(s.m.slice(5)) - 1]} ${s.m.slice(0, 4)}</div>
    <div class="grid2" style="margin-top:10px"><label class="f"><span>Ποσό</span><input name="a" inputmode="decimal" value="${esc(String(s.a).replace('.', ','))}"></label>
    <label class="f"><span>Πληρώθηκε στις</span><input type="date" name="paid" value="${esc(s.paid || (eom(s.m) < t ? t : t))}"></label></div>
    <button class="btn green" data-paid>${s.paid ? 'Αποθήκευση' : '✓ Πληρώθηκε'}</button>
    ${s.paid ? '<button class="btn" data-unpaid>Δεν έχει πληρωθεί ακόμα</button>' : '<button class="btn" data-save>Αλλαγή ποσού μόνο</button>'}
    <button class="btn" data-del style="color:var(--red)">Διαγραφή</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    const a = () => parseAmount(el.querySelector('[name=a]').value);
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-save]')?.addEventListener('click', async () => { await store.put(L.LSP, s.id, { a: a() }); close(); ui.toast('Αποθηκεύτηκε ✓'); });
    el.querySelector('[data-paid]').onclick = async () => {
      const paid = el.querySelector('[name=paid]').value || t; const amt = a(); if (!amt) { ui.toast('Γράψε ποσό'); return; }
      const md = paid < eom(s.m) ? paid : eom(s.m);
      const txid = s.tx || `saltx:${s.id}`;
      await store.putMany(L.LSP, [
        { id: txid, set: { type: 'tx', kind: 'Έσοδο', cat: 'Μισθός', payer: 'Άλκης', for: '', d: paid, md: md === paid ? null : md, a: amt,
          desc: `Μισθός ${s.src} ${MONTHS_GEN[Number(s.m.slice(5)) - 1]}`, sal: s.id } },
        { id: s.id, set: { a: amt, paid, tx: txid } }]);
      close(); ui.toast('Μπήκε στα έσοδα ✓');
    };
    el.querySelector('[data-unpaid]')?.addEventListener('click', async () => {
      await store.putMany(L.LSP, [...(s.tx ? [{ id: s.tx, del: true }] : []), { id: s.id, set: { paid: null, tx: null } }]);
      close(); ui.toast('Αποθηκεύτηκε ✓');
    });
    el.querySelector('[data-del]').onclick = async () => {
      if (!(await ui.confirm(s.paid ? 'Θα σβηστεί και από τα έσοδα. Διαγραφή;' : 'Διαγραφή;', 'Διαγραφή'))) return;
      await store.putMany(L.LSP, [...(s.tx ? [{ id: s.tx, del: true }] : []), { id: s.id, del: true }]); close();
    };
  });
}
function salAddSheet(ui, Y) {
  const months = L.yMonths(Y).slice(1); const t = today();
  const srcs = [...new Set(store.records('sal', [L.LSP]).map((s) => s.src))];
  const cur = t.slice(0, 7); const def = months.includes(cur) ? cur : months[0];
  const opt = (sel) => months.map((m) => `<option value="${m}" ${m === sel ? 'selected' : ''}>${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</option>`).join('');
  sheet(`<div class="mid">Νέος μισθός</div>
    <label class="f" style="margin-top:10px"><span>Από πού (π.χ. Σχολείο, ΔΥΠΑ)</span><input name="src" list="srcs" value="${esc(srcs[srcs.length - 1] || '')}"><datalist id="srcs">${srcs.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>
    <label class="f"><span>Ποσό κάθε μήνα</span><input name="a" inputmode="decimal"></label>
    <div class="grid2"><label class="f"><span>Από μήνα</span><select name="m1">${opt(def)}</select></label><label class="f"><span>Έως μήνα</span><select name="m2">${opt(months[11])}</select></label></div>
    <button class="btn primary" data-ok>Προσθήκη</button><button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-ok]').onclick = async () => {
      const src = el.querySelector('[name=src]').value.trim(); const a = parseAmount(el.querySelector('[name=a]').value);
      const m1 = el.querySelector('[name=m1]').value, m2 = el.querySelector('[name=m2]').value;
      if (!src || !a) { ui.toast('Πηγή και ποσό'); return; }
      const have = new Set(store.records('sal', [L.LSP]).map((s) => `${s.src}|${s.m}`));
      const ch = months.filter((m) => m >= m1 && m <= m2 && !have.has(`${src}|${m}`)).map((m) => ({ id: null, set: { type: 'sal', src, m, a } }));
      await store.putMany(L.LSP, ch); close(); ui.toast(`${ch.length} μήνες ✓`);
    };
  });
}

// ---------------- statistics ----------------
let statY = null;
export const statsView = {
  html() {
    const t = today(); statY = statY ?? L.yearOf(t);
    const s = L.yearStats(statY);
    const n0 = (x) => eur0(x).replace(' €', '');
    const hist = L.history(); const prev = hist.find((h) => h.Y === statY - 1);
    const anyExtra = s.months.some((r) => r.extra);
    const rows = s.months.map((r, i) => {
      const fut = (i === 0 ? L.yStart(statY) : `${r.m}-01`) > t;
      const cur = t.startsWith(r.m) && L.monthIdx(statY, t) === i;
      const py = prev?.m[i];
      return `<tr class="${cur ? 'cur' : ''}" style="${fut ? 'opacity:.6;font-style:italic' : ''}"><td>${MSHORT[Number(r.m.slice(5)) - 1]} ${r.m.slice(2, 4)}</td>
        <td class="r">${r.les ? n0(r.les) : ''}</td><td class="r">${r.sal ? n0(r.sal) : ''}</td>${anyExtra ? `<td class="r">${r.extra ? n0(r.extra) : ''}</td>` : ''}
        <td class="r"><b>${r.total ? n0(r.total) : ''}</b></td><td class="r muted">${py ? n0(py) : ''}</td><td class="r">${r.recv ? n0(r.recv) : ''}</td></tr>`;
    }).join('');
    const maxY = Math.max(...hist.map((h) => h.total), 1);
    return `<div class="top">${back()}<h1>Στατιστικά μαθημάτων</h1></div>
    <div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-y="-1">◀</button><div class="grow center mid">Χρονιά ${L.yLabel(statY)}</div><button class="btn sm ghost" data-y="1">▶</button></div>
    <div class="grid3">
      <div class="card kpi"><div class="label">Σύνολο χρονιάς</div><div class="mid">${n0(s.total)}</div></div>
      <div class="card kpi"><div class="label">Διαθέσιμα / μήνα (÷12)</div><div class="mid">${n0(s.total / 12)}</div></div>
      <div class="card kpi"><div class="label">Πέρσι ÷12</div><div class="mid muted">${prev ? n0(prev.total / 12) : '–'}</div></div>
    </div>
    <div class="card" style="overflow-x:auto"><div class="small muted" style="margin-bottom:4px">σε €</div><table class="t st"><tr><th>Μήνας</th><th class="r">Μαθήμ.</th><th class="r">Μισθοί</th>${anyExtra ? '<th class="r">Έκτακτα</th>' : ''}<th class="r">Σύνολο</th><th class="r">Πέρσι</th><th class="r">Εισπρ.</th></tr>
      ${rows}<tr class="tot"><td>Σύνολο</td><td class="r">${n0(s.les)}</td><td class="r">${n0(s.sal)}</td>${anyExtra ? `<td class="r">${n0(s.extra)}</td>` : ''}<td class="r">${n0(s.total)}</td><td class="r muted">${prev ? n0(prev.total) : ''}</td><td class="r">${n0(s.recv)}</td></tr>
      <tr><td>÷12</td><td class="r">${n0(s.les / 12)}</td><td class="r">${n0(s.sal / 12)}</td>${anyExtra ? `<td class="r">${n0(s.extra / 12)}</td>` : ''}<td class="r"><b>${n0(s.total / 12)}</b></td><td class="r muted">${prev ? n0(prev.total / 12) : ''}</td><td></td></tr></table>
      <div class="small muted" style="margin-top:8px">Μαθήματα = όλος ο μήνας μαζί με τα προγραμματισμένα (πλάγια = μελλοντικοί μήνες). Εισπρ. = πληρωμές που πήρες μέσα στον μήνα.
      Μ.Ο. μήνα δουλειάς: <b>${n0(s.avgWork)}</b> (${s.weeks} εβδομάδες με μαθήματα ≈ ${s.workMonths.toFixed(1).replace('.', ',')} μήνες).</div></div>
    <h2>Όλες οι χρονιές</h2>
    <div class="card">${hist.slice().reverse().map((h) => `<div class="row" style="margin:6px 0" data-gy="${h.Y}"><span style="width:58px" class="small"><b>${String(h.Y).slice(2)}-${String(h.Y + 1).slice(2)}</b></span>
      <div class="grow bar"><i style="width:${Math.round((h.total / maxY) * 100)}%;${h.Y === statY ? 'background:var(--brand)' : ''}"></i></div>
      <span class="small" style="width:120px;text-align:right">${eur0(h.total)} · <span class="muted">${eur0(h.total / 12)}/μ</span></span></div>`).join('')}</div>
    <details class="more"><summary>Πίνακας ανά μήνα ▾</summary><div class="card" style="overflow-x:auto"><table class="t st" style="min-width:820px">
      <tr><th>Χρονιά</th>${L.yMonths(2000).map((m, i) => `<th class="r">${MSHORT[Number(m.slice(5)) - 1]}${i === 12 ? '²' : ''}</th>`).join('')}<th class="r">Σύνολο</th></tr>
      ${hist.slice().reverse().map((h) => `<tr><td>${String(h.Y).slice(2)}-${String(h.Y + 1).slice(2)}</td>${h.m.map((x) => `<td class="r">${x ? eur0(x).replace(' €', '') : ''}</td>`).join('')}<td class="r"><b>${eur0(h.total)}</b></td></tr>`).join('')}
    </table></div></details>`;
  },
  mount(root, p, ui) {
    bindBack(root, ui);
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { statY += Number(b.dataset.y); ui.render(); }));
    root.querySelectorAll('[data-gy]').forEach((b) => b.addEventListener('click', () => { statY = Number(b.dataset.gy); ui.render(); window.scrollTo(0, 0); }));
  },
};

// ---------------- holidays ----------------
let holY = null;
export const holView = {
  html() {
    holY = holY ?? L.yearOf(today());
    const list = L.holidays(holY);
    return `<div class="top">${back()}<h1>Αργίες</h1></div>
    <div class="row" style="margin-bottom:8px"><button class="btn sm ghost" data-y="-1">◀</button><div class="grow center mid">Χρονιά ${L.yLabel(holY)}</div><button class="btn sm ghost" data-y="1">▶</button></div>
    <div class="list">${list.map((h) => `<div class="item" data-hol="${esc(h.id)}" style="${h.off ? 'opacity:.5' : ''}">
      <div class="dot">${h.kind === 'αργία' ? '🏖' : h.kind === 'γιορτή' ? '🎌' : '⭐'}</div>
      <div class="grow"><div class="t" style="${h.off ? 'text-decoration:line-through' : ''}">${esc(h.name)}</div>
      <div class="s">${dShort(h.from)}${h.to !== h.from ? ' – ' + dShort(h.to) : ''} · ${h.kind}${h.auto ? ' · αυτόματα' : ''}${h.off ? ' · δεν ισχύει' : ''}</div></div><div class="muted">›</div></div>`).join('')}</div>
    <button class="btn primary" style="width:100%;margin-top:12px" data-add>+ Δική μου αργία / διακοπές</button>
    <div class="note small" style="margin-top:12px">Στις αργίες δεν μπαίνουν αυτόματα μαθήματα (αν γίνει μάθημα, το προσθέτεις από την καρτέλα). Γιορτές και ειδικές μέρες μόνο χρωματίζονται. Το Πάσχα και οι κινητές γιορτές υπολογίζονται μόνες τους κάθε χρονιά.</div>`;
  },
  mount(root, p, ui) {
    bindBack(root, ui);
    root.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { holY += Number(b.dataset.y); ui.render(); }));
    root.querySelector('[data-add]').addEventListener('click', () => holSheet(ui, null));
    root.querySelectorAll('[data-hol]').forEach((b) => b.addEventListener('click', () => {
      const h = L.holidays(holY).find((x) => x.id === b.dataset.hol);
      if (!h.auto) { holSheet(ui, h); return; }
      const key = `${h.name}:${h.from}`;
      ui.confirm(h.off ? `Να ισχύει ξανά «${esc(h.name)}»;` : `«${esc(h.name)}»: να μην ισχύει φέτος (να μπαίνουν κανονικά μαθήματα);`, h.off ? 'Να ισχύει' : 'Να μην ισχύει', false).then(async (ok) => {
        if (!ok) return;
        const ex = store.records('holoff', [L.LSP]).find((r) => r.key === key);
        if (ex) await store.del(L.LSP, ex.id); else await store.put(L.LSP, null, { type: 'holoff', key });
      });
    }));
  },
};
function holSheet(ui, h) {
  let kind = h?.kind || 'αργία';
  sheet(`<div class="mid">${h ? 'Αργία' : 'Νέα αργία'}</div>
    <label class="f" style="margin-top:10px"><span>Περιγραφή</span><input name="name" value="${esc(h?.name || '')}" placeholder="π.χ. Διακοπές μας"></label>
    <div class="grid2"><label class="f"><span>Από</span><input type="date" name="from" value="${esc(h?.from || today())}"></label>
    <label class="f"><span>Έως (κενό = μία μέρα)</span><input type="date" name="to" value="${esc(h && h.to !== h.from ? h.to : '')}"></label></div>
    <label class="f"><span>Τύπος</span><div class="seg" data-seg="kind">${[['αργία', 'Αργία (χωρίς μαθήματα)'], ['γιορτή', 'Γιορτή'], ['ειδική', 'Ειδική']].map(([v, l]) => `<button type="button" data-val="${v}" class="${v === kind ? 'on' : ''}">${l}</button>`).join('')}</div></label>
    <button class="btn primary" data-ok>Αποθήκευση</button>${h ? '<button class="btn" data-del style="color:var(--red)">Διαγραφή</button>' : ''}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-seg]').addEventListener('click', (e) => { if (!e.target.dataset.val) return; kind = e.target.dataset.val; el.querySelectorAll('[data-seg] button').forEach((b) => b.classList.toggle('on', b === e.target)); });
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-del]')?.addEventListener('click', async () => { await store.del(L.LSP, h.id); close(); });
    el.querySelector('[data-ok]').onclick = async () => {
      const name = el.querySelector('[name=name]').value.trim(), from = el.querySelector('[name=from]').value, to = el.querySelector('[name=to]').value || null;
      if (!name || !from) { ui.toast('Περιγραφή και ημερομηνία'); return; }
      await store.put(L.LSP, h?.id || null, { type: 'hol', name, from, to, kind }); close(); ui.toast('Αποθηκεύτηκε ✓');
    };
  });
}

// ---------------- all students (also the ones who stopped) ----------------
export const allView = {
  html() {
    const t = today(); const list = L.students();
    const act = list.filter((s) => L.isActive(s)), old = list.filter((s) => !L.isActive(s));
    const row = (s) => { const b = L.balance(s.id); return `<div class="item" data-go="#/lessons/s/${esc(s.id)}"><div class="dot">${esc(s.name.slice(0, 1))}</div>
      <div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${s.start ? 'από ' + dFull(s.start) : ''}${s.end ? ' έως ' + dFull(s.end) : ''} · ${eur(L.priceAt(s, t).price)}/${hoursTxt(L.priceAt(s, t).dur)}</div></div>
      <div class="amt ${b > 0.005 ? 'neg' : ''}">${Math.abs(b) < 0.005 ? '✓' : eur(b)}</div></div>`; };
    return `<div class="top">${back()}<h1>Όλοι οι μαθητές</h1><a class="btn sm" href="#/lessons/edit/new">+ Νέος</a></div>
    <h2>Τώρα (${act.length})</h2><div class="list">${act.map(row).join('') || '<div class="item muted">—</div>'}</div>
    <h2>Παλιοί (${old.length})</h2><div class="list">${old.map(row).join('') || '<div class="item muted">—</div>'}</div>`;
  },
  mount(root, p, ui) { bindBack(root, ui); root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go))); },
};
export { lessonSheet, addDays, DSHORT };
