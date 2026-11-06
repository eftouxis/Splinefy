// Recurring items like Monefy: change or delete «only this time» / «this and the next ones» / «all (also the past)».
// One item can be stored as several parts (a part ends the day before the next one starts): «all» and «next ones» cover them.
import * as store from './store.js';
import { addDays, addMonths, norm } from './util.js';

/** parts of one recurring item: same kind, one ends the day before the next one starts */
export function chain(d) {
  const all = store.records('rec').filter((x) => x.kind === d.kind && x.start);
  const out = [d]; let a = d, b = d;
  for (let i = 0; i < 50; i++) { const p = all.find((x) => x.end && x.end < a.start && x.end >= addDays(a.start, -45) && !out.includes(x) && (x.name === a.name || x.a === a.a) && x.unit === a.unit && x.every === a.every); if (!p) break; out.push(p); a = p; }
  for (let i = 0; i < 50; i++) { if (!b.end) break; const n = all.find((x) => x.start > b.end && x.start <= addDays(b.end, 45) && !out.includes(x) && (x.name === b.name || x.a === b.a) && x.unit === b.unit && x.every === b.every); if (!n) break; out.push(n); b = n; }
  return out;
}
const clean = (def) => { const { id: _i, _t, _u, _m, _x, _sp, ...rest } = def; return rest; };
/** the part that holds day d, and the later parts */
const later = (def, d) => chain(def).filter((p) => p.id !== def.id && p.start > d);

/** from the time on day d (and the later parts): new fields; the earlier times stay as they were */
export async function fromHere(def, d, set) {
  for (const p of later(def, d)) { const { start: _s, ...s2 } = set; await store.put(p._sp, p.id, s2); }
  if (!def.start || d <= def.start) return store.put(def._sp, def.id, set);
  const base = clean(def);                 // copy before the record changes (records are updated in place)
  await store.put(def._sp, def.id, { end: addDays(d, -1) });
  await store.put(def._sp, null, { ...base, ...set, start: set.start || d });
}
/** every time, also the past ones (start moves only on this part) */
export async function all(def, set) {
  const { start, ...s2 } = set;
  for (const p of chain(def)) await store.put(p._sp, p.id, p.id === def.id ? set : s2);
  void start;
}
/** delete the time on day d and every later one (the earlier ones stay) */
export async function delFrom(def, d) {
  for (const p of later(def, d)) await store.del(p._sp, p.id);
  if (!def.start || d <= def.start) return store.del(def._sp, def.id);
  return store.put(def._sp, def.id, { end: addDays(d, -1) });
}
/** delete the item with all its times, also the past ones */
export async function delAll(def) { for (const p of chain(def)) await store.del(p._sp, p.id); }

/** the time before the first one */
const prevOf = (r) => (r.unit === 'd' ? addDays(r.start, -(r.every || 1)) : addMonths(r.start, -(r.every || 1)));
/** an item made with «from now on it is recurring» started at the next time and left the first time as a separate movement:
 *  that movement becomes the first time of the item (so «all» / «this and the next ones» cover it too). Only plain movements. */
export async function adoptFirst() {
  let n = 0;
  for (const r of store.records('rec')) {
    if (!r.start || !store.state.data[r._sp]?.recs.has(r.id)) continue;
    const pd = prevOf(r); const name = norm(r.name).trim();
    if (chain(r).some((p) => p.id !== r.id && p.start <= pd && (!p.end || p.end >= pd))) continue;
    const tx = store.records('tx', [r._sp]).find((t) => !t.fx && !t.rec && t.kind === r.kind && t.d === pd && norm(t.desc || t.cat).trim() === name && t.cat === r.cat
      && t.payer === r.payer && (t.for || '') === (r.for || '') && !t.stu && !t.car && !t.trip && !(t.oth && t.oth.length) && t.both == null && !t.cred && !t.ofc);
    if (!tx) continue;
    await store.put(r._sp, r.id, { start: pd });
    if (Math.abs((tx.a || 0) - (r.a || 0)) > 0.004 || tx.note) await store.put(r._sp, `${r.id}@${pd}`, { type: 'recx', a: tx.a, note: tx.note || null });
    await store.del(tx._sp, tx.id); n++;
  }
  return n;
}
