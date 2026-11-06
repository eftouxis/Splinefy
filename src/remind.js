// Reminders by email or on the phone (Google Calendar event with a pop-up, ch:'cal'): the open «next time» notes of the lessons and the Εργασίες go to my own Google Apps Script (tools/reminders-gas.js),
// which emails them on the morning of the day they show. Only reminder text, student and day leave the device.
import * as store from './store.js';
import * as L from './lessons.js';
import * as C from './chores.js';
import * as M from './meds.js';
import { dShort, dFull, addDays } from './util.js';

// the setting lives in my own (private) space: each of us can have their own script and email
const mine = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1)?.id || null;
export const pref = () => (mine() ? store.records('pref', [mine()]).find((r) => r.id === 'remind') : null) || {};
export const setPref = (fields) => store.put(mine(), 'remind', { type: 'pref', ...fields });
export const available = () => !!mine();

function items() {
  const chores = C.all().filter((c) => (c.mailTo || []).includes(store.state.user)).map((c) => {
    // «πότε»: the morning of the day (default, one email with all of them) or N days before at a time (the evening before, a week before…)
    let show = c.due, at = null;
    if (c.rmdD || c.rmdT) { show = addDays(c.due, -(Number(c.rmdD) || 0)); at = `${show}T${c.rmdT || '09:00'}`; if (new Date(at).getTime() < Date.now() - 3 * 36e5) { at = null; show = c.due; } }
    return { id: `ch:${c.id}`, show, ...(at ? { at } : {}), icon: '✅', who: c.name, text: `λήγει ${dFull(c.due)}`, next: c.last ? `τελευταία ${dFull(c.last)}` : '', ...(c.ch === 'cal' ? { ch: 'cal' } : {}) };
  });
  const other = store.state.user === 'Άλκης' ? 'Χαρά' : 'Άλκης'; const cc = pref().cc || ''; const now = Date.now();
  // Φάρμακα: one item per dose (the next ~10 days), email or phone (Google Calendar) — the other person by email (cc) if they have no script of their own
  const meds = M.active().filter((m) => (m.mailTo || []).includes(store.state.user) || ((m.mailTo || []).includes(other) && cc)).flatMap((m) => {
    const st = M.status(m); const ch = m.ch === 'cal' ? 'cal' : 'mail';
    const open = st.ds.filter((d) => d.given == null && !d.missed && d.at >= now - 3 * 36e5).slice(0, 30);
    return open.flatMap((d) => {
      const w = d.at - (Number(m.lead) || 0) * 60000;              // «πότε»: at the dose or some minutes before
      const base = { show: M.local(w).slice(0, 10), at: M.local(w), icon: '💊', who: `${m.name}${m.who ? ' · ' + m.who : ''}`, text: `ώρα για δόση${m.dose ? ' (' + m.dose + ')' : ''} — ${M.hm(d.at)}${m.notes ? ' · ' + m.notes : ''}`,
        next: st.total ? `δόση ${d.k + 1} από ${st.total}` : '' };
      const id = `md:${m.id}:${M.local(d.at)}`; const out = [];
      if ((m.mailTo || []).includes(store.state.user)) out.push({ ...base, id, ch, to: ['me'] });
      if ((m.mailTo || []).includes(other) && cc) out.push({ ...base, id: id + ':cc', ch: 'mail', to: [cc] });
      return out;
    });
  });
  if (!L.hasLessons()) return [...chores, ...meds];
  return [...chores, ...meds, ...L.openNotes().map((n) => {
    const st = L.student(n.stu); const nx = L.nextLessonFrom(n.stu, L.noteShow(n));
    return { id: n.id, show: L.noteShow(n), who: st ? L.label(st) : '', text: n.text, next: nx ? `μάθημα ${dShort(nx.d)}${nx.time ? ' ' + nx.time : ''}` : '' };
  })].sort((a, b) => (a.show < b.show ? -1 : 1));
}
async function post(url, body) {
  await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
}
let timer = null;
/** send the list when it changed (called after every change; quiet and cheap) */
export function push(force = false) {
  const url = pref().url; if (!url) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const it = items(); const sig = JSON.stringify([url, it]);
      if (!force && localStorage.getItem('remindSig') === sig) return;
      await post(url, { items: it }); localStorage.setItem('remindSig', sig);
    } catch (_) { /* offline: next time */ }
  }, force ? 0 : 3000);
}
export async function test(url) { await post(url, { test: 1, items: items() }); try { localStorage.setItem('remindSig', JSON.stringify([url, items()])); } catch (_) { /* */ } }
