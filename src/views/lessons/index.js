// #/lessons… — router of the lessons screens (only Άλκης)
import { esc, eur, today, addDays, dShort, MONTHS, MONTHS_GEN } from '../../util.js';
import * as L from '../../lessons.js';
import { syncBadge } from '../../main.js';
import { sheet, lessonSheet, addLessonSheet, paySheet, fmtH, hoursTxt } from './ui.js';
import studentView from './student.js';
import { editView, schedView, salView, statsView, holView, allView, helpView } from './more.js';

let weekOff = 0;
const home = {
  html() {
    const t = today();
    const act = L.students().filter((s) => L.isActive(s) || L.balance(s.id) > 0.005);
    if (!L.students().length) {
      return `<div class="top"><h1>Μαθήματα</h1>${syncBadge()}</div>
      <div class="card center"><div class="mid" style="margin-bottom:8px">Δεν υπάρχουν ακόμα μαθητές</div>
      <div class="small muted" style="margin-bottom:12px">Πρόσθεσε μαθητή ή φέρε τα δεδομένα από το Excel (Ρυθμίσεις → Εισαγωγή).</div>
      <a class="btn primary" href="#/lessons/edit/new">+ Νέος μαθητής</a></div>`;
    }
    const sums = act.map((s) => ({ s, ...L.summary(s.id) }));
    const owed = sums.reduce((a, x) => a + (x.bal > 0.005 ? x.bal : 0), 0);
    const m = t.slice(0, 7);
    const mon = L.lessons({ from: `${m}-01`, to: `${m}-31` });
    const done = mon.filter((l) => l.d <= t).reduce((a, l) => a + l.v, 0), plan = mon.reduce((a, l) => a + l.v, 0);
    // week
    const ws = addDays(L.isoWeekStart(t), weekOff * 7), we = addDays(ws, 6);
    const wl = L.lessons({ from: ws, to: we, all: true });
    let days = '';
    for (let d = ws; d <= we; d = addDays(d, 1)) {
      const ls = wl.filter((l) => l.d === d); const hol = L.holidayOn(d);
      if (!ls.length && !(hol && d >= ws)) continue;
      days += `<div class="day ${d === t ? 'today' : ''}">${dShort(d)}${d === t ? ' · σήμερα' : ''}${hol ? ` · <span class="hol-${hol.kind === 'αργία' ? 'a' : 'g'}">${esc(hol.name)}</span>` : ''}</div>`;
      days += ls.map((l) => {
        const st = L.student(l.stu); const past = l.d <= t;
        const status = !l.h ? '<span class="neg">δεν έγινε</span>' : past ? '<span class="pos">✓ έγινε</span>' : '';
        const b = L.balance(l.stu);
        return `<div class="item" data-lesson="${esc(l.stu)}|${l.d}" style="${l.h ? '' : 'opacity:.6'}">
          <div class="dot" style="font-size:12px;font-weight:700">${esc((l.time || '').split(/[–-]/)[0] || '•')}</div>
          <div class="grow"><div class="t" style="${l.h ? '' : 'text-decoration:line-through'}">${esc(st.name)}</div>
          <div class="s">${l.h ? hoursTxt(l.h) : hoursTxt(l.sched)}${l.ov && l.sched && l.h ? ' · αλλαγή' : !l.sched ? ' · έκτακτο' : ''}${b > 0.005 ? ` · <b class="neg">χρωστάει ${eur(b)}</b>` : b < -0.005 ? ` · <span class="pos">προπλήρωσε ${eur(-b)}</span>` : ''}</div></div>
          <div class="right"><div class="amt">${l.h ? eur(l.v) : ''}</div><div class="small">${status}</div></div></div>`;
      }).join('') || '';
    }
    const order = sums.sort((a, b) => (Math.abs(b.bal) > 0.005) - (Math.abs(a.bal) > 0.005) || b.bal - a.bal || a.s.name.localeCompare(b.s.name, 'el'));
    return `<div class="top"><h1>Μαθήματα</h1>${syncBadge()}</div>
    <div class="grid2">
      <div class="card kpi"><div class="label">Μου χρωστάνε</div><div class="big ${owed > 0.005 ? 'neg' : ''}">${eur(owed)}</div>
        <div class="small">${sums.filter((x) => x.bal > 0.005).sort((a, b) => b.bal - a.bal).map((x) => `${esc(x.s.name)} <b>${eur(x.bal)}</b>`).join('<br>')}</div></div>
      <div class="card kpi" data-go="#/lessons/stats"><div class="label">${MONTHS[Number(m.slice(5)) - 1]}: μαθήματα ως σήμερα</div><div class="big">${eur(done)}</div>
        <div class="small muted">όλος ο μήνας: ${eur(plan)}</div></div>
    </div>
    <div class="grid3 quick" style="margin-bottom:12px">
      <button class="btn green" data-pay>+ Πληρωμή</button><button class="btn blue" data-addlesson>+ Μάθημα</button><a class="btn" href="#/lessons/edit/new">+ Μαθητής</a>
    </div>
    <div class="row" style="margin:14px 2px 6px"><h2 class="grow" style="margin:0">${weekOff === 0 ? 'Αυτή την εβδομάδα' : weekOff === 1 ? 'Επόμενη εβδομάδα' : weekOff === -1 ? 'Προηγούμενη εβδομάδα' : `${dShort(ws)} – ${dShort(we)}`}</h2>
      <button class="btn sm ghost" data-w="-1">◀</button>${weekOff ? '<button class="btn sm ghost" data-w="0">σήμερα</button>' : ''}<button class="btn sm ghost" data-w="1">▶</button></div>
    <div class="list">${days || '<div class="item muted">Κανένα μάθημα</div>'}</div>
    <div class="small muted" style="margin:6px 4px 0">«✓ έγινε» = το μάθημα έγινε (όχι ότι πληρώθηκε). Πάτα ένα μάθημα για «δεν έγινε» ή άλλες ώρες.</div>
    <h2>Μαθητές</h2>
    <div class="list">${order.map(({ s, bal, unpaidH, next }) => `<div class="item" data-go="#/lessons/s/${esc(s.id)}">
      <div class="dot">${esc(s.name.slice(0, 1))}</div>
      <div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${next ? 'επόμενο ' + dShort(next.d) + (next.time ? ' ' + esc(next.time.split(/[–-]/)[0]) : '') : L.isActive(s) ? 'χωρίς πρόγραμμα' : 'σταμάτησε'}</div></div>
      <div class="right"><div class="amt ${bal > 0.005 ? 'neg' : bal < -0.005 ? 'pos' : 'muted'}">${Math.abs(bal) < 0.005 ? '✓' : eur(Math.abs(bal))}</div>
      <div class="small muted">${bal > 0.005 ? `χρωστάει · ${fmtH(unpaidH)} ώρ.` : bal < -0.005 ? 'προπληρωμένα' : 'εξοφλημένος'}</div></div></div>`).join('')}</div>
    <div class="grid3" style="margin-top:12px">
      <a class="btn sm" href="#/lessons/sched">🗓 Πρόγραμμα</a><a class="btn sm" href="#/lessons/sal">💼 Μισθοί</a><a class="btn sm" href="#/lessons/stats">📊 Στατιστικά</a>
      <a class="btn sm" href="#/lessons/hol">🏖 Αργίες</a><a class="btn sm" href="#/lessons/all">👥 Όλοι οι μαθητές</a><a class="btn sm" href="#/lessons/help">❓ Οδηγίες</a>
    </div>`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { weekOff = b.dataset.w === '0' ? 0 : weekOff + Number(b.dataset.w); ui.render(); }));
    root.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => { const [s, d] = b.dataset.lesson.split('|'); lessonSheet(s, d, ui); }));
    root.querySelector('[data-pay]')?.addEventListener('click', () => paySheet(ui));
    root.querySelector('[data-addlesson]')?.addEventListener('click', () => addLessonSheet(ui));
  },
};

const PAGES = { s: studentView, edit: editView, sched: schedView, sal: salView, stats: statsView, hol: holView, all: allView, help: helpView };
const pick = (p) => (!L.hasLessons() ? denied : PAGES[p[0]] || home);
const denied = { html: () => '<div class="card">Τα μαθήματα φαίνονται μόνο στον Άλκη.</div>' };
export default {
  live: true,
  html(p, ui) { return pick(p).html(p.slice(1), ui); },
  mount(root, p, ui) { pick(p).mount?.(root, p.slice(1), ui); },
};
export { MONTHS_GEN, sheet };
