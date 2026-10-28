import { esc, eur, today, addDays, monthLabel, dShort, MONTHS_GEN } from '../util.js';
import { movements, debt, totals, fx } from '../ledger.js';
import { state } from '../store.js';
import { itemHtml, bindEdit, ICON } from './common.js';
import { syncBadge } from '../main.js';
import * as LS from '../lessons.js';
import * as PP from '../people.js';

let viewSel = null, monthOff = 0;

export default {
  live: true,
  html() {
    const me = state.user; const t = today();
    viewSel = viewSel || me;
    const list = movements();
    const d = debt(list);
    const owe = d.alkisMinusShare;
    const debtTxt = owe >= 0 ? 'Η Χαρά χρωστάει στον Άλκη' : 'Ο Άλκης χρωστάει στη Χαρά';
    // month
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + monthOff);
    const mk = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
    const from = `${mk}-01`, last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const to = monthOff === 0 ? t : `${mk}-${last}`;
    const cur = totals(list, viewSel, from, to);
    const lyFrom = `${base.getFullYear() - 1}${from.slice(4)}`, lyTo = `${base.getFullYear() - 1}${to.slice(4)}`;
    const ly = totals(list, viewSel, lyFrom, lyTo);
    const cats = [...cur.byCat.entries()].filter(([c, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxc = cats.length ? cats[0][1] : 1;
    const views = [me, 'Κοινά', 'Φίλιππος'];
    // upcoming recurring (14 days)
    const up = list.filter((r) => r.rec && !r.skipped && r.d > t && r.d <= addDays(t, 14)).sort((a, b) => (a.d < b.d ? -1 : 1)).slice(0, 8);
    const recent = list.filter((r) => !r.rec && r.d <= t).sort((a, b) => (a.d === b.d ? ((b._m || '') > (a._m || '') ? 1 : -1) : a.d < b.d ? 1 : -1)).slice(0, 8);
    const lessons = list.filter((r) => r.cat === 'Ιδιαίτερα' && r.kind === 'Έσοδο' && r.d >= `${t.slice(0, 7)}-01` && r.d <= t && (me === 'Άλκης'));
    const lessonSum = lessons.reduce((s, r) => s + (r.a || 0), 0);
    return `
    <div class="top"><h1>Οικονομικά</h1>${syncBadge()}</div>
    <div class="grid2">
      <div class="card kpi" data-go="#/list/shared"><div class="label">${debtTxt}</div><div class="big ${owe >= 0 ? '' : 'neg'}">${eur(Math.abs(owe))}</div></div>
      <div class="card kpi" data-go="#/list/philippos"><div class="label">Ο Άλκης χρωστάει στον Φίλιππο</div><div class="big">${eur(d.philippos)}</div></div>
    </div>
    <div class="grid3 quick" style="margin-bottom:12px">
      <a class="btn red" href="#/add/exp">− Έξοδο</a><a class="btn green" href="#/add/inc">+ Έσοδο</a><a class="btn blue" href="#/add/trf">⇄ Μεταφορά</a>
    </div>
    <div class="card">
      <div class="row"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${monthLabel(mk)}${monthOff === 0 ? ' <span class="small muted">ως σήμερα</span>' : ''}</div>
        <button class="btn sm ghost" data-m="1" ${monthOff >= 0 ? 'disabled' : ''}>▶</button></div>
      <div class="chips" style="margin:8px 0 12px;justify-content:center">${views.map((v) => `<button class="chip ${v === viewSel ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="grid3 center">
        <div><div class="small muted">Έσοδα</div><div class="mid pos">${eur(cur.inc)}</div></div>
        <div><div class="small muted">Έξοδα</div><div class="mid neg">${eur(cur.exp)}</div></div>
        <div><div class="small muted">Διαφορά</div><div class="mid ${cur.diff < 0 ? 'neg' : 'pos'}">${eur(cur.diff)}</div></div>
      </div>
      <div class="small muted center" style="margin-top:6px">Ίδια περίοδος πέρσι: έσοδα ${eur(ly.inc)} · έξοδα ${eur(ly.exp)}</div>
      ${cats.length ? `<h2 style="margin-top:14px">Πού πήγαν</h2>` + cats.map(([c, v]) => {
        const pv = ly.byCat.get(c) || 0; const dlt = v - pv;
        return `<div style="margin:8px 0"><div class="row"><span>${ICON[c] || '•'}</span><span class="grow">${esc(c)}</span><b>${eur(v)}</b>
          <span class="small ${dlt > 0 ? 'neg' : 'pos'}" style="width:70px;text-align:right">${pv ? (dlt > 0 ? '▲ ' : '▼ ') + eur(Math.abs(dlt)).replace(' €', '') : ''}</span></div>
          <div class="bar" style="margin-top:4px"><i style="width:${Math.round((v / maxc) * 100)}%"></i></div></div>`;
      }).join('') : ''}
    </div>
    ${LS.hasLessons() ? lessonsCard(lessonSum) : ''}
    ${peopleCard()}
    <h2>Έρχονται τις επόμενες 14 μέρες</h2>
    <div class="list">${up.length ? up.map((r) => itemHtml(r, { showDate: true, today: t })).join('') : '<div class="item muted">Τίποτα</div>'}</div>
    <h2>Τελευταίες κινήσεις</h2>
    <div class="list">${recent.map((r) => itemHtml(r, { showDate: true, today: t })).join('') || '<div class="item muted">Καμία ακόμα</div>'}</div>
    <div class="center" style="margin-top:10px"><a class="btn sm" href="#/list">Όλες οι κινήσεις ›</a></div>`;
  },
  mount(root, p, ui) {
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { monthOff = Math.min(0, monthOff + Number(b.dataset.m)); ui.render(); }));
    root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { viewSel = b.dataset.v; ui.render(); }));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    bindEdit(root, ui);
  },
};
function peopleCard() {
  const ps = PP.people().map((p) => ({ p, b: PP.balance(p.id) })).filter((x) => Math.abs(x.b) > 0.005);
  return `<div class="card row" data-go="#/people" style="cursor:pointer"><div class="dot">🤝</div><div class="grow">
    <div class="small muted">Χρωστούμενα με άλλους</div>
    ${ps.length ? `<div class="small">${ps.map((x) => `${esc(x.p.name)} <b class="${x.b > 0 ? 'pos' : 'neg'}">${x.b > 0 ? 'μου χρωστάει ' : 'χρωστάω '}${eur(Math.abs(x.b))}</b>`).join('<br>')}</div>` : '<div class="small muted">Όλα εντάξει — πάτα για αδερφή, μαμά, φίλους…</div>'}
    </div><div class="muted">›</div></div>`;
}
function lessonsCard(recv) {
  const t = today(); const has = LS.students().length;
  const debt = LS.students().map((s) => ({ s, b: LS.balance(s.id) })).filter((x) => x.b > 0.005).sort((a, b) => b.b - a.b);
  const owed = debt.reduce((a, x) => a + x.b, 0);
  const tl = LS.lessons({ from: t, to: t });
  return `<div class="card row" data-go="#/lessons" style="cursor:pointer"><div class="dot">📚</div><div class="grow">
    <div class="small muted">Ιδιαίτερα ${MONTHS_GEN[new Date().getMonth()]}: εισπράξεις ${eur(recv)}</div>
    <div class="mid">${has ? `Μου χρωστάνε ${eur(owed)}` : 'Μαθήματα'}</div>
    ${debt.length ? `<div class="small">${debt.map((x) => `${esc(x.s.name)} <b class="neg">${eur(x.b)}</b>`).join(' · ')}</div>` : ''}
    ${has ? `<div class="small muted">${tl.length ? `Σήμερα: ${tl.map((l) => esc(LS.student(l.stu).name)).join(', ')}` : 'Σήμερα κανένα μάθημα'}</div>` : ''}</div><div class="muted">›</div></div>`;
}
const INC = new Set(['Μισθός', 'Ιδιαίτερα', 'Πωλήσεις', 'Επιδόματα', 'Δώρο', 'Από οικογένεια', 'Ενοίκιο', 'Άλλο']);
function isIncomeCat(c) { return INC.has(c); }
export { fx };
