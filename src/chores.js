// Εργασίες: things that repeat every N days / weeks / months / years (cleaning, vaccines, check-ups…).
// Due = the next date set, else last done + the interval. Ticking = done today (kept in the history). Email when due (remind.js).
import * as store from './store.js';
import { today, addDays, addMonths } from './util.js';

export const UNITS = [['d', 'μέρες', 'μέρα'], ['w', 'εβδομάδες', 'εβδομάδα'], ['m', 'μήνες', 'μήνα'], ['y', 'χρόνια', 'χρόνο']];
export const mySpace = () => store.state.spaces.find((s) => s.owner === store.state.user && s.members.length === 1)?.id || null;
export const step = (d, every, unit) => (unit === 'd' ? addDays(d, every) : unit === 'w' ? addDays(d, 7 * every) : unit === 'y' ? addMonths(d, 12 * every) : addMonths(d, every));
/** fixed dates: the k-th date from the first one (same day of month, or «1st / last Monday» of the month) */
const DAYN = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const NTH = ['1η', '2η', '3η', '4η', '5η'];
const pz = (n) => String(n).padStart(2, '0');
export function occ(c, k) {
  const a = c.anchor, n = (Number(c.every) || 1) * k, u = c.unit || 'm';
  if (u === 'd' || u === 'w') return addDays(a, u === 'w' ? 7 * n : n);
  if (u === 'y' && !c.wk) return addMonths(a, 12 * n);
  if (!c.wk) return addMonths(a, n);
  const [Y, M] = a.split('-').map(Number); const mm = (M - 1) + (u === 'y' ? 12 * n : n); const y = Y + Math.floor(mm / 12), m = mm % 12;
  const wd = new Date(a + 'T12:00').getDay();
  if (c.wk === 'last') { const last = new Date(y, m + 1, 0, 12); const back = (last.getDay() - wd + 7) % 7; return `${y}-${pz(m + 1)}-${pz(last.getDate() - back)}`; }
  const first = new Date(y, m, 1, 12); const d = 1 + ((wd - first.getDay() + 7) % 7) + 7 * (Number(c.wk) - 1);
  const dim = new Date(y, m + 1, 0).getDate(); return `${y}-${pz(m + 1)}-${pz(Math.min(d, dim))}`;
}
/** the first fixed date after a day ('' = the first one) */
export function occAfter(c, d) { for (let k = 0; k < 20000; k++) { const x = occ(c, k); if (!d || x > d) return x; } return c.anchor; }
/** «1η Δευτέρα του μήνα» options for a first date */
export const wkOpts = (a) => { const d = new Date(a + 'T12:00'); const nth = Math.ceil(d.getDate() / 7); const last = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return [['', `ίδια ημερομηνία (${d.getDate()})`], ...(nth <= 4 ? [[String(nth), `${NTH[nth - 1]} ${DAYN[d.getDay()]}`]] : []), ...(last ? [['last', `τελευταία ${DAYN[d.getDay()]}`]] : [])]; };
export const due = (c) => {
  if (c.next) return c.next;
  if (c.mode === 'fixed' && c.anchor) return occAfter(c, c.doneOcc || '');       // fixed dates: the one after the last done (missed ones stay due)
  return c.last ? step(c.last, Number(c.every) || 1, c.unit || 'm') : today();
};
export const all = () => store.records('chore').map((c) => ({ ...c, due: due(c) })).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.name || '').localeCompare(b.name || '')));
export const daysTo = (d) => Math.round((new Date(d + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
export const everyTxt = (c) => { const n = Number(c.every) || 1; const u = UNITS.find((x) => x[0] === (c.unit || 'm')) || UNITS[2];
  const base = n === 1 ? `κάθε ${u[2]}` : `κάθε ${n} ${u[1]}`;
  if (c.mode !== 'fixed') return base + ' μετά την ολοκλήρωση';
  const w = c.wk && c.anchor ? wkOpts(c.anchor).find((o) => o[0] === c.wk)?.[1] : '';
  return `${base}${w ? `, ${w}` : ''} (σταθερές ημερομηνίες)`; };
export const groups = () => [...new Set(store.records('chore').map((c) => c.grp).filter(Boolean))].sort();
// ---- ιστορικό: όλες οι φορές που έγινε (χωρίς όριο) — {d, by, n} (παλιές εγγραφές: σκέτη ημερομηνία) ----
export const ent = (x) => (typeof x === 'string' ? { d: x } : x || {});
export const hist = (c) => (c.hist || []).map(ent).filter((e) => e.d).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
const pack = (l) => l.map((e) => (e.by || e.n ? { d: e.d, ...(e.by ? { by: e.by } : {}), ...(e.n ? { n: e.n } : {}) } : e.d));
const maxD = (l) => l.reduce((m, e) => (e.d > m ? e.d : m), '') || null;
/** done on day d (σήμερα ή άλλη μέρα), με προαιρετική σημείωση: η επόμενη μετράει από την πιο πρόσφατη φορά */
export async function done(c, d = today(), note = null) {
  const fixedOcc = c.mode === 'fixed' && c.anchor ? due(c) : null;            // fixed dates: this date is done, the next one stays on its date
  const l = [{ d, by: store.state.user, n: note || null }, ...hist(c).filter((e) => e.d !== d)].sort((a, b) => (a.d < b.d ? 1 : -1));
  await store.put(c._sp, c.id, { last: maxD(l), next: null, hist: pack(l), undoD: d, undoK: 'done', prevLast: c.last || null, prevNext: c.next || null, prevOcc: c.doneOcc || null, ...(fixedOcc ? { doneOcc: fixedOcc } : {}) });
}
export async function undo(c) {
  if (c.undoK === 'skip') { await store.put(c._sp, c.id, { next: c.prevNext ?? null, skips: (c.skips || []).slice(1), undoK: null, ...(c.mode === 'fixed' ? { doneOcc: c.prevOcc ?? null } : {}) }); return; }
  const l = hist(c).filter((e) => e.d !== (c.undoD || hist(c)[0]?.d));
  await store.put(c._sp, c.id, { last: c.prevLast ?? maxD(l), next: c.prevNext ?? null, hist: pack(l), undoD: null, ...(c.mode === 'fixed' ? { doneOcc: c.prevOcc ?? null } : {}) });
}
/** προσπέραση αυτής της φοράς: δεν μετράει ως «έγινε» — η λήξη πάει στην επόμενη (μετά την ολοκλήρωση: +1 διάστημα από τη λήξη· σταθερές: η επόμενη ημερομηνία) */
export async function skip(c) {
  const d0 = due(c); const fixed = c.mode === 'fixed' && c.anchor;
  const set = fixed ? { next: null, doneOcc: d0 } : { next: step(d0, Number(c.every) || 1, c.unit || 'm') };
  await store.put(c._sp, c.id, { ...set, skips: [{ d: d0, by: store.state.user }, ...(c.skips || []).filter((x) => x.d !== d0)], undoK: 'skip', prevNext: c.next || null, prevOcc: c.doneOcc || null });
  return due({ ...c, ...set });
}
export async function delSkip(c, d) { await store.put(c._sp, c.id, { skips: (c.skips || []).filter((x) => x.d !== d), undoK: null }); }
/** διόρθωση μιας φοράς (ημερομηνία / σημείωση) ή διαγραφή της (fields = null) */
export async function editHist(c, d0, fields) {
  let l = hist(c); const e = l.find((x) => x.d === d0); if (!e) return;
  l = l.filter((x) => x !== e);
  if (fields) { const ne = { ...e, d: fields.d || e.d, n: fields.n ?? e.n }; l = [ne, ...l.filter((x) => x.d !== ne.d)].sort((a, b) => (a.d < b.d ? 1 : -1)); }
  const wasLast = c.last === d0 || !c.last;
  await store.put(c._sp, c.id, { hist: pack(l), ...(wasLast || (fields?.d && fields.d > (c.last || '')) ? { last: maxD(l) } : {}), undoD: null });
}
/** όλες οι φορές από όλες τις εργασίες, πιο πρόσφατες πρώτες */
export const allHist = (list = all()) => list.flatMap((c) => [...hist(c).map((e) => ({ ...e, c })), ...(c.skips || []).map((e) => ({ ...e, skip: true, c }))]).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (a.c.name || '').localeCompare(b.c.name || '')));
/** the ones that should be done by today (for the home page) */
export const dueNow = () => all().filter((c) => c.due <= today() && (!c.who || c.who === store.state.user || c._sp === 'shared'));
