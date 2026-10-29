import { esc, eur, today, addDays, monthLabel, dShort, MONTHS_GEN } from '../util.js';
import { movements, debt, totals, fx } from '../ledger.js';
import { state } from '../store.js';
import { itemHtml, bindEdit, ICON } from './common.js';
import { syncBadge } from '../main.js';
import * as LS from '../lessons.js';
import * as PP from '../people.js';
import * as PL from '../plan.js';

let viewSel = null, monthOff = 0, allCats = false;
const LS_KEY = 'homePer';
let per = (() => { try { return localStorage.getItem(LS_KEY) || 'm'; } catch (_) { return 'm'; } })();
let rFrom = null, rTo = null;
const PERS = [['d', 'Μέρα'], ['w', 'Εβδομάδα'], ['m', 'Μήνας'], ['y', 'Έτος'], ['r', 'Διάστημα']];
const dd = (s) => `${s.slice(8)}/${s.slice(5, 7)}`;
/** the chosen period: {from, to, label, cur(=includes today)} */
function period(t) {
  if (per === 'd') { const d = addDays(t, monthOff); return { from: d, to: d, label: `${dShort(d)}/${d.slice(2, 4)}`, cur: monthOff === 0 }; }
  if (per === 'w') { const wd = (new Date(t + 'T12:00').getDay() + 6) % 7; const a = addDays(t, -wd + 7 * monthOff), b = addDays(a, 6); return { from: a, to: b, label: `${dd(a)} – ${dd(b)}/${b.slice(2, 4)}`, cur: monthOff === 0 }; }
  if (per === 'y') { const y = Number(t.slice(0, 4)) + monthOff; return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y), cur: monthOff === 0 }; }
  if (per === 'r') { const a = rFrom || `${t.slice(0, 7)}-01`, b = rTo || t; return { from: a <= b ? a : b, to: a <= b ? b : a, label: '', cur: false }; }
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + monthOff);
  const mk = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`; const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return { from: `${mk}-01`, to: `${mk}-${last}`, label: monthLabel(mk), cur: monthOff === 0 };
}
const yb = (s) => `${Number(s.slice(0, 4)) - 1}${s.slice(4)}`;

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
    const P = period(t); const from = P.from, to = P.to > t ? t : P.to;          // never count the future (planned recurring items)
    const nDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
    const cur = totals(list, viewSel, from, to);
    const lyFrom = yb(from), lyTo = yb(to);
    const ly = totals(list, viewSel, lyFrom, lyTo);
    const catsAll = [...cur.byCat.entries()].filter(([c, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const cats = allCats ? catsAll : catsAll.slice(0, 5);
    const incs = [...cur.byInc.entries()].filter(([c, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
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
      <div class="card kpi" data-go="#/philippos"><div class="label">Ο Άλκης χρωστάει στον Φίλιππο</div><div class="big">${eur(d.philippos)}</div></div>
    </div>
    <div class="grid3 quick" style="margin-bottom:12px">
      <a class="btn red" href="#/add/exp">− Έξοδο</a><a class="btn green" href="#/add/inc">+ Έσοδο</a><a class="btn blue" href="#/add/trf">⇄ Μεταφορά</a>
    </div>
    ${newsCard(t)}${roomCard()}
    <div class="card">
      <div class="seg per" style="margin-bottom:10px">${PERS.map(([k, l]) => `<button class="${k === per ? 'on' : ''}" data-per="${k}">${l}</button>`).join('')}</div>
      ${per === 'r' ? `<div class="grid2"><label class="f"><span>Από</span><input type="date" name="rf" value="${from}"></label><label class="f"><span>Έως</span><input type="date" name="rt" value="${P.to}"></label></div>`
        : `<div class="row"><button class="btn sm ghost" data-m="-1">◀</button><div class="grow center mid">${P.label}${P.cur && per !== 'd' ? ' <span class="small muted">ως σήμερα</span>' : ''}</div>
        <button class="btn sm ghost" data-m="1" ${monthOff >= 0 ? 'disabled' : ''}>▶</button></div>`}
      <div class="chips" style="margin:8px 0 12px;justify-content:center">${views.map((v) => `<button class="chip ${v === viewSel ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="grid3 center">
        <div><div class="small muted">Έσοδα</div><div class="mid pos">${eur(cur.inc)}</div></div>
        <div><div class="small muted">Έξοδα</div><div class="mid neg">${eur(cur.exp)}</div></div>
        <div><div class="small muted">Διαφορά</div><div class="mid ${cur.diff < 0 ? 'neg' : 'pos'}">${eur(cur.diff)}</div></div>
      </div>
      <div class="small muted center" style="margin-top:6px">${nDays > 1 ? `${nDays} μέρες · έξοδα ${eur(cur.exp / nDays)} τη μέρα<br>` : ''}Ίδια περίοδος πέρσι: έσοδα ${eur(ly.inc)} · έξοδα ${eur(ly.exp)}</div>
      ${cur.save > 0.004 ? `<div class="small center" style="margin-top:6px">📈 Επενδύσεις / αποταμίευση: <b>${eur(cur.save)}</b> <span class="muted">(δεν μετράνε στα έξοδα)</span> · μένουν <b class="${cur.diff - cur.save < 0 ? 'neg' : 'pos'}">${eur(cur.diff - cur.save)}</b></div>` : ''}
      <div class="center" style="margin-top:8px"><button class="btn sm" data-plist="${from}|${to}">Κινήσεις περιόδου ›</button></div>
      ${cats.length ? `<h2 style="margin-top:14px">Πού πήγαν</h2>` + cats.map(([c, v]) => {
        const pv = ly.byCat.get(c) || 0; const dlt = v - pv;
        return `<div style="margin:8px 0;cursor:pointer" data-hcat="Έξοδο|${esc(c)}"><div class="row"><span>${ICON[c] || '•'}</span><span class="grow">${esc(c)}</span><b>${eur(v)}</b>
          <span class="small ${dlt > 0 ? 'neg' : 'pos'}" style="width:70px;text-align:right">${pv ? (dlt > 0 ? '▲ ' : '▼ ') + eur(Math.abs(dlt)).replace(' €', '') : ''}</span></div>
          <div class="bar" style="margin-top:4px"><i style="width:${Math.round((v / maxc) * 100)}%"></i></div></div>`;
      }).join('') + (catsAll.length > 5 ? `<div class="center"><button class="btn sm ghost" data-allcats>${allCats ? 'Λιγότερες ▴' : `Όλες οι κατηγορίες (${catsAll.length}) ▾`}</button></div>` : '') : ''}
      ${incs.length ? `<h2 style="margin-top:14px">Από πού ήρθαν</h2>` + incs.map(([c, v]) => `<div class="row" style="margin:6px 0;cursor:pointer" data-hcat="Έσοδο|${esc(c)}"><span>${ICON[c] || '•'}</span><span class="grow">${esc(c)}</span><b class="pos">${eur(v)}</b><span class="muted">›</span></div>`).join('') : ''}
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
    root.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { per = b.dataset.per; monthOff = 0; try { localStorage.setItem(LS_KEY, per); } catch (_) { /* private mode */ } ui.render(); }));
    root.querySelector('[data-allcats]')?.addEventListener('click', () => { allCats = !allCats; ui.render(); });
    root.querySelectorAll('[name=rf],[name=rt]').forEach((el) => el.addEventListener('change', () => { if (!el.value) return; if (el.name === 'rf') rFrom = el.value; else rTo = el.value; ui.render(); }));
    const lview = () => (viewSel === 'Κοινά' ? 'home' : viewSel === 'Φίλιππος' ? 'phil' : 'mine');
    root.querySelectorAll('[data-hcat]').forEach((el) => el.addEventListener('click', () => {
      const [kind, cat] = el.dataset.hcat.split('|'); const [a, b] = root.querySelector('[data-plist]').dataset.plist.split('|');
      window.__listSet?.({ from: a, to: b, q: '', cat, kind, view: lview() }); ui.go('#/list');
    }));
    root.querySelector('[data-plist]')?.addEventListener('click', (e) => { const [a, b] = e.target.dataset.plist.split('|'); window.__listSet?.({ from: a, to: b, q: '', view: lview() }); ui.go('#/list'); });
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { monthOff = Math.min(0, monthOff + Number(b.dataset.m)); ui.render(); }));
    root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { viewSel = b.dataset.v; ui.render(); }));
    root.querySelector('[data-seen]')?.addEventListener('click', (e) => { e.stopPropagation(); try { localStorage.setItem(SEEN, today()); } catch (_) { /* */ } ui.render(); });
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    bindEdit(root, ui);
  },
};
const SEEN = 'seenUntil';
/** recurring items that went in by themselves since the last visit (on this device) */
function newsCard(t) {
  let seen = null; try { seen = localStorage.getItem(SEEN); if (!seen) localStorage.setItem(SEEN, t); } catch (_) { return ''; }
  if (!seen || seen >= t) return '';
  const l = movements().filter((r) => r.rec && !r.skipped && r.d > seen && r.d <= t).sort((a, b) => (a.d < b.d ? -1 : 1));
  if (!l.length) { try { localStorage.setItem(SEEN, t); } catch (_) { /* */ } return ''; }
  return `<div class="card" style="border-left:4px solid var(--teal)"><div class="row"><b class="grow">🔔 Καταχωρήθηκαν μόνα τους (${l.length})</b><button class="btn sm" data-seen>OK</button></div>
    <div class="small" style="margin-top:6px">${l.slice(0, 8).map((r) => `${dShort(r.d)} · ${esc(r.desc || r.cat)} <b>${eur(r.a)}</b>`).join('<br>')}${l.length > 8 ? `<br>… και ${l.length - 8} ακόμα` : ''}</div></div>`;
}
function roomCard() {
  const R = PL.room(); if (!R) return '';
  const col = R.level === 'over' ? 'var(--red)' : R.level === 'warn' ? '#e0a030' : 'var(--teal)';
  const x = R.ps[0];
  return `<div class="card" data-go="#/people/${esc(x.p.id)}" style="cursor:pointer;border-left:4px solid ${col}">
    <div class="row"><b class="grow">🎯 Ξεχρέωμα ${esc(R.ps.map((s) => s.p.name).join(', '))}</b><span class="muted">›</span></div>
    <div class="small" style="margin-top:4px">Μένουν <b>${eur(R.ps.reduce((s, y) => s + y.debt, 0))}</b> · ${R.ps.map((s) => `${eur(s.m)}/μήνα → τέλος <b>${PL.mLabel(s.end)}</b>`).join(' · ')}</div>
    <div class="small" style="margin-top:4px">Αυτόν τον μήνα: δόση ${R.due > 0.004 ? `<b>${eur(R.due)}</b> ακόμα` : '<b class="pos">✓ δόθηκε</b>'}</div>
    <div style="margin-top:6px;color:${col};font-weight:700">${R.level === 'over' ? `⚠ Ξεπέρασες κατά ${eur(-R.free)} — η δόση δεν βγαίνει αν δεν κόψεις έξοδα` : R.level === 'warn' ? `⚠ Πρόσεχε: μπορείς να ξοδέψεις ακόμα μόνο ${eur(R.free)} αυτόν τον μήνα` : `Μπορείς να ξοδέψεις ακόμα ${eur(R.free)} αυτόν τον μήνα`}</div>
    <div class="small muted" style="margin-top:2px">= έσοδα ${eur(R.basis)}${R.basis > R.inc + 0.004 ? ' (μ.ο. 3 μηνών)' : ''} − έξοδα ${eur(R.exp)}${R.save ? ` − επενδύσεις ${eur(R.save)}` : ''} − δόση ${eur(R.due)}</div></div>`;
}
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
    ${debt.length ? `<div class="small">${debt.map((x) => `${esc(LS.label(x.s))} <b class="neg">${eur(x.b)}</b>`).join(' · ')}</div>` : ''}
    ${has ? `<div class="small muted">${tl.length ? `Σήμερα: ${tl.map((l) => esc(LS.label(LS.student(l.stu)))).join(', ')}` : 'Σήμερα κανένα μάθημα'}</div>` : ''}</div><div class="muted">›</div></div>`;
}
const INC = new Set(['Μισθός', 'Ιδιαίτερα', 'Πωλήσεις', 'Επιδόματα', 'Δώρο', 'Από οικογένεια', 'Ενοίκιο', 'Άλλο']);
function isIncomeCat(c) { return INC.has(c); }
export { fx };
