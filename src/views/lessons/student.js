// #/lessons/s/<id> — the student's card (like the Excel sheet of each student)
import { esc, eur, today, addDays, dShort, dFull, MONTHS, MSHORT, pad, parseISO } from '../../util.js';
import * as L from '../../lessons.js';
import { lessonSheet, addLessonSheet, paySheet, slotSheet, fmtH, hoursTxt, DSHORT } from './ui.js';

let month = null, cur = null;
export default {
  html([id]) {
    const st = L.student(id);
    if (!st) return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Δεν βρέθηκε</h1></div>`;
    const t = today();
    if (cur !== id) { cur = id; month = t.slice(0, 7); }
    const x = L.summary(id); const pr = L.priceAt(st);
    const bal = x.bal;
    // calendar
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`, last = `${month}-${pad(new Date(y, m, 0).getDate())}`;
    const ls = new Map(L.lessons({ stu: id, from: first, to: last, all: true }).map((l) => [l.d, l]));
    let cells = ''; const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) cells += '<div></div>';
    let mh = 0, mv = 0;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const l = ls.get(d); const hol = L.holidayOn(d); const we = [0, 6].includes(parseISO(d).getDay());
      if (l?.h) { mh += l.h; mv += l.v; }
      const cls = ['cal-d', d === t ? 'today' : '', hol ? (hol.kind === 'αργία' ? 'hol' : 'fest') : '', we ? 'we' : '',
        l ? (l.h ? (d <= t ? 'done' : 'plan') : 'off') : '', st.start && d < st.start ? 'out' : '', st.end && d > st.end ? 'out' : ''].join(' ');
      cells += `<button class="${cls}" data-day="${d}" title="${esc(hol?.name || '')}"><span>${Number(d.slice(8))}</span><b>${l ? (l.h ? fmtH(l.h) : '✗') : ''}</b></button>`;
    }
    const mp = L.payments(id).filter((p) => p.d.startsWith(month)).reduce((s, p) => s + p.a, 0);
    // school-year table
    const Y = L.yearOf(t);
    const rows = L.yMonths(Y).map((mk, i) => {
      const from = i === 0 ? L.yStart(Y) : `${mk}-01`, to = i === 12 ? L.yEnd(Y) : `${mk}-31`;
      const ll = L.lessons({ stu: id, from, to });
      const h = ll.reduce((s, l) => s + l.h, 0), v = ll.reduce((s, l) => s + l.v, 0);
      const p = L.payments(id).filter((q) => q.d >= from && q.d <= to).reduce((s, q) => s + q.a, 0);
      if (!h && !p) return '';
      return `<tr style="${from > t ? 'opacity:.55;font-style:italic' : ''}"><td>${MSHORT[Number(mk.slice(5)) - 1]} ${mk.slice(2, 4)}</td><td class="r">${fmtH(h)}</td><td class="r">${eur(v)}</td><td class="r">${p ? eur(p) : ''}</td></tr>`;
    }).join('');
    const pays = L.payments(id);
    const sl = L.slots(id).sort((a, b) => (a.to || '9') < (b.to || '9') ? 1 : -1);
    const activeSl = sl.filter((s) => !s.to || s.to >= t), oldSl = sl.filter((s) => s.to && s.to < t);
    const slotRow = (s) => `<div class="item" data-slot="${esc(s.id)}"><div class="dot" style="font-size:13px;font-weight:700">${DSHORT[s.wd - 1]}</div>
      <div class="grow"><div class="t">${L.DAYNAMES[s.wd - 1]} · ${hoursTxt(s.h)}${s.time ? ' · ' + esc(s.time) : ''}</div>
      <div class="s">${dFull(s.from)} → ${s.to ? dFull(s.to) : 'χωρίς τέλος'}</div></div><div class="muted">›</div></div>`;
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>${esc(L.label(st))}</h1><a class="btn sm" href="#/lessons/edit/${esc(id)}">Επεξεργασία</a></div>
    ${st.full && st.full !== L.label(st) ? `<div class="small muted" style="margin:-6px 4px 10px">${esc(st.full)}${st.note ? ' · ' + esc(st.note) : ''}</div>` : st.note ? `<div class="small muted" style="margin:-6px 4px 10px">${esc(st.note)}</div>` : ''}
    <div class="grid2">
      <div class="card kpi"><div class="label">${Math.abs(bal) < 0.005 ? 'Εξοφλημένος' : bal > 0 ? 'Χρωστάει' : 'Προπληρωμένα'}</div>
        <div class="big ${bal > 0.005 ? 'neg' : bal < -0.005 ? 'pos' : ''}">${Math.abs(bal) < 0.005 ? '✓' : eur(Math.abs(bal))}</div>
        <div class="small muted">${bal > 0.005 ? `${fmtH(x.unpaidH)} ώρες απλήρωτες` : x.lastPay ? 'τελευταία πληρωμή ' + dFull(x.lastPay.d) : ''}</div></div>
      <div class="card kpi"><div class="label">Τιμή</div><div class="mid" style="margin-top:4px">${eur(pr.price)} / ${hoursTxt(pr.dur)}</div>
        <div class="small muted">${eur(x.rate)} την ώρα${st.end && st.end < t ? ' · σταμάτησε ' + dFull(st.end) : ''}</div></div>
    </div>
    <div class="grid2 quick" style="margin-bottom:12px"><button class="btn green" data-pay>+ Πληρωμή</button><button class="btn blue" data-addlesson>+ Μάθημα</button></div>
    <div class="card">
      <div class="row"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${MONTHS[m - 1]} ${y}</div><button class="btn sm ghost" data-m="1">▶</button></div>
      <div class="cal">${DSHORT.map((d) => `<div class="cal-h">${d}</div>`).join('')}${cells}</div>
      <div class="row small muted" style="margin-top:8px"><span class="grow">${hoursTxt(mh)} · ${eur(mv)}</span><span>πληρωμές μήνα: ${eur(mp)}</span></div>
      <div class="small muted" style="margin-top:4px">Πάτα μια μέρα για να αλλάξεις ώρες, να το σημειώσεις «δεν έγινε» ή να προσθέσεις μάθημα.</div>
    </div>
    <h2>Πρόγραμμα κάθε εβδομάδα</h2>
    <div class="list">${activeSl.map(slotRow).join('') || '<div class="item muted">Χωρίς πρόγραμμα</div>'}
      <div class="item" data-newslot><div class="dot">+</div><div class="grow t" style="color:var(--teal)">Προσθήκη ημέρας</div></div></div>
    ${oldSl.length ? `<details class="more" style="margin-top:6px"><summary>Παλιό πρόγραμμα (${oldSl.length}) ▾</summary><div class="list">${oldSl.map(slotRow).join('')}</div></details>` : ''}
    <h2>Χρονιά ${L.yLabel(Y)}</h2>
    <div class="card"><table class="t"><tr><th>Μήνας</th><th class="r">Ώρες</th><th class="r">Αξία</th><th class="r">Πληρωμές</th></tr>${rows || '<tr><td colspan="4" class="muted">—</td></tr>'}</table>
      ${st.open ? `<div class="small muted" style="margin-top:6px">Από πριν: ${eur(st.open)}</div>` : ''}</div>
    <h2>Πληρωμές</h2>
    <div class="list">${pays.slice(0, 40).map((p) => `<div class="item" data-paytx="${esc(p.id)}"><div class="dot">💶</div>
      <div class="grow"><div class="t">${dFull(p.d)}</div><div class="s">${esc(p.note || '')}</div></div><div class="amt pos">+${eur(p.a)}</div></div>`).join('') || '<div class="item muted">Καμία ακόμα</div>'}</div>`;
  },
  mount(root, [id], ui) {
    root.querySelector('[data-back]')?.addEventListener('click', () => ui.go('#/lessons'));
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + Number(b.dataset.m), 1);
      month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; ui.render();
    }));
    root.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.day; const l = L.lessons({ stu: id, from: d, to: d, all: true })[0];
      if (l) lessonSheet(id, d, ui); else addLessonSheet(ui, id, d);
    }));
    root.querySelector('[data-pay]')?.addEventListener('click', () => paySheet(ui, id));
    root.querySelector('[data-addlesson]')?.addEventListener('click', () => addLessonSheet(ui, id));
    root.querySelector('[data-newslot]')?.addEventListener('click', () => slotSheet(ui, id));
    root.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => slotSheet(ui, id, L.slots(id).find((s) => s.id === b.dataset.slot))));
    root.querySelectorAll('[data-paytx]').forEach((b) => b.addEventListener('click', () => paySheet(ui, id, L.payments(id).find((p) => p.id === b.dataset.paytx))));
  },
};
export { dShort };
