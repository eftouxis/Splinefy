// #/trips — trips: dates (auto-tag while you travel), totals, movements
import { esc, eur, today, dFull, addDays, norm } from '../util.js';
import * as store from '../store.js';
import * as T from '../trips.js';
import { itemHtml, bindEdit } from './common.js';
import { sheet } from './lessons/ui.js';

const span = (t) => (t.start && t.end ? `${dFull(t.start)} – ${dFull(t.end)}` : t.start ? `από ${dFull(t.start)}` : 'χωρίς ημερομηνίες');
const listView = {
  html() {
    const t = today();
    const all = T.trips().map((x) => ({ x, s: T.summary(x.name) })).sort((a, b) => ((b.s.to || b.x.end || '9') > (a.s.to || a.x.end || '9') ? 1 : -1));
    const on = T.tripOn(t);
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>Ταξίδια</h1><button class="btn sm primary" data-new>+ Ταξίδι</button></div>
    ${on ? `<div class="note" style="margin-bottom:10px">✈️ Τώρα είσαι στο «<b>${esc(on.name)}</b>» — ό,τι έξοδο γράφεις μπαίνει εκεί μόνο του (μπορείς να το βγάλεις από το έξοδο).</div>` : ''}
    <div class="list">${all.map(({ x, s }) => `<div class="item" data-go="#/trips/${encodeURIComponent(x.name)}"><div class="dot">✈️</div>
      <div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${x.start ? span(x) : s.from ? `${dFull(s.from)} · ` : ''}${s.list.length ? ` · ${s.list.length} έξοδα · ${eur(s.N / s.days)}/μέρα` : ' · κανένα έξοδο ακόμα'}${x.auto !== false && x.start && x.end && t <= x.end ? ' · <span class="pos">αυτόματα</span>' : ''}</div></div>
      <div class="amt">${s.N ? eur(s.N) : ''}</div></div>`).join('') || '<div class="item muted">Κανένα ταξίδι</div>'}</div>
    <div class="note small" style="margin-top:12px">Βάλε ημερομηνίες στο ταξίδι και όσο διαρκεί, κάθε νέο έξοδο μπαίνει μόνο του σε αυτό. Για έξοδα πριν φύγεις (π.χ. αεροπορικά), στο έξοδο → «Περισσότερα» → «Ταξίδι» και διαλέγεις το ταξίδι.</div>`;
  },
  mount(root, p, ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/stats/trips'));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ui.go(b.dataset.go)));
    root.querySelector('[data-new]').addEventListener('click', () => tripSheet(ui, null));
  },
};
const detail = {
  html([name]) {
    const s = T.summary(name); const x = s.trip; const t = today();
    const ls = s.list.slice().sort((a, b) => (a.d < b.d ? 1 : -1));
    const me = store.state.user;
    return `<div class="top"><button class="btn sm ghost" data-back>‹</button><h1>✈️ ${esc(x.name)}</h1><button class="btn sm" data-edit>Επεξεργασία</button></div>
    <div class="small muted" style="margin:-6px 4px 10px">${x.start ? span(x) : s.from ? `${dFull(s.from)} – ${dFull(s.to)} (από τα έξοδα)` : 'χωρίς ημερομηνίες'}${x.auto !== false && x.start && x.end ? ' · τα έξοδα αυτών των ημερών μπαίνουν μόνα τους' : ''}</div>
    <div class="grid3"><div class="card kpi"><div class="label">Σύνολο</div><div class="mid">${eur(s.N)}</div></div>
      <div class="card kpi"><div class="label">Ανά μέρα (${s.days})</div><div class="mid">${eur(s.N / s.days)}</div></div>
      <div class="card kpi"><div class="label">${me === 'Χαρά' ? 'Μερίδιο Χαράς' : 'Μερίδιο Άλκη'}</div><div class="mid">${eur(me === 'Χαρά' ? s.S : s.Q)}</div><div class="small muted">${me === 'Χαρά' ? 'Άλκης' : 'Χαρά'} ${eur(me === 'Χαρά' ? s.Q : s.S)}</div></div></div>
    <a class="btn green" style="width:100%;margin-bottom:12px" href="#/add/exp?trip=${encodeURIComponent(x.name)}">+ Έξοδο σε αυτό το ταξίδι</a>
    <div class="list">${ls.map((r) => itemHtml(r, { showDate: true, today: t })).join('') || '<div class="item muted">Κανένα έξοδο ακόμα</div>'}</div>`;
  },
  mount(root, [name], ui) {
    root.querySelector('[data-back]').addEventListener('click', () => ui.go('#/trips'));
    root.querySelector('[data-edit]').addEventListener('click', () => tripSheet(ui, T.byName(name) || { name }));
    bindEdit(root, ui);
  },
};
/** new / edit a trip; renaming re-tags its movements */
export function tripSheet(ui, x, after) {
  const isNew = !x;
  x = x || { name: '', auto: true };
  sheet(`<div class="mid">${isNew ? 'Νέο ταξίδι' : 'Ταξίδι'}</div>
    <label class="f" style="margin-top:10px"><span>Όνομα</span><input name="name" value="${esc(x.name)}" placeholder="π.χ. Βρυξέλλες Πάσχα 2027"></label>
    <div class="grid2"><label class="f"><span>Από</span><input type="date" name="start" value="${esc(x.start || '')}"></label>
      <label class="f"><span>Έως</span><input type="date" name="end" value="${esc(x.end || '')}"></label></div>
    <label class="row small" style="margin:0 2px 12px"><input type="checkbox" name="auto" style="width:auto" ${x.auto !== false ? 'checked' : ''}> Τα έξοδα αυτών των ημερών να μπαίνουν μόνα τους στο ταξίδι</label>
    <button class="btn primary" data-save>Αποθήκευση</button>${isNew ? '' : '<button class="btn" data-del style="color:var(--red)">Διαγραφή ταξιδιού</button>'}<button class="btn ghost" data-no>Άκυρο</button>`, (el, close) => {
    el.querySelector('[data-no]').onclick = close;
    el.querySelector('[data-save]').onclick = async () => {
      const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
      const name = v('name'); let start = v('start') || null, end = v('end') || null; const auto = el.querySelector('[name=auto]').checked;
      if (!name) { ui.toast('Γράψε όνομα'); return; }
      if (start && end && end < start) [start, end] = [end, start];
      if (start && !end) end = start;
      const dup = T.byName(name); if (dup && dup.id && dup.id !== x.id) { ui.toast('Υπάρχει ήδη ταξίδι με αυτό το όνομα'); return; }
      await store.put(T.SP, x.id || null, { type: 'trip', name, start, end, auto });
      if (!isNew && norm(name).trim() !== norm(x.name).trim()) await retag(x.name, name);
      close();
      if (start && end && auto) {
        const ex = T.untaggedIn(start, end);
        if (ex.length && await ui.confirm(`Υπάρχουν ήδη ${ex.length} έξοδα από ${dFull(start)} έως ${dFull(end)} χωρίς ταξίδι (σύνολο ${eur(ex.reduce((s, r) => s + (r.a || 0), 0))}). Να μπουν στο «${esc(name)}»;`, 'Ναι, να μπουν', false)) await tagAll(ex, name);
      }
      ui.toast('Αποθηκεύτηκε ✓');
      if (after) after(name); else ui.go(`#/trips/${encodeURIComponent(name)}`);
    };
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      const n = T.moves(x.name).filter((r) => !r.rec).length;
      if (!(await ui.confirm(`Διαγραφή του «${esc(x.name)}»;${n ? ` Τα ${n} έξοδα μένουν, απλώς χωρίς ταξίδι.` : ''}`, 'Διαγραφή'))) return;
      await retag(x.name, null); if (x.id) await store.del(T.SP, x.id); close(); ui.go('#/trips');
    });
  });
}
async function tagAll(list, name) {
  const by = new Map(); for (const r of list) { if (!by.has(r._sp)) by.set(r._sp, []); by.get(r._sp).push({ id: r.id, set: { trip: name } }); }
  for (const [sp, ch] of by) await store.putMany(sp, ch);
}
async function retag(oldName, name) { await tagAll(T.moves(oldName).filter((r) => !r.rec && store.state.data[r._sp]?.recs.has(r.id)), name); }

export default {
  live: true,
  html(p, ui) { return (p[0] ? detail : listView).html(p, ui); },
  mount(root, p, ui) { (p[0] ? detail : listView).mount(root, p, ui); },
};
void addDays;
